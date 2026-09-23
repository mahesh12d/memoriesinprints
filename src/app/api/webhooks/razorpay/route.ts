import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { verifyWebhookSignature } from "@/lib/payments/webhook-signature";
import { markOrderPaid } from "@/lib/payments/settle";

/**
 * Razorpay's own report that a payment succeeded.
 *
 * Until this existed, an order only became paid when the customer's browser
 * came back from the payment page and posted to confirmPaymentAction. If they
 * paid and then closed the tab, lost signal, or the redirect failed, the money
 * was taken and the order sat unpaid until somebody noticed by hand. This path
 * does not involve the customer's browser at all, so it still arrives when
 * they walk away.
 *
 * Both paths end at markOrderPaid, which is idempotent — whichever gets there
 * first wins and the other changes nothing.
 */

export const dynamic = "force-dynamic";

/** The events that mean money has actually been taken. */
const PAID_EVENTS = new Set(["payment.captured", "order.paid"]);

type Entity = { id?: string; order_id?: string; amount?: number; currency?: string };

export async function POST(request: Request) {
  // Must be the raw bytes: the signature is over the body exactly as sent.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  if (
    !verifyWebhookSignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET)
  ) {
    // 400 rather than 401: there is nothing here for Razorpay to retry, and a
    // 4xx stops it resending. Nothing is logged about the body — an unsigned
    // delivery is from a stranger.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: { event?: string; payload?: Record<string, { entity?: Entity }> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  /**
   * Everything else — refunds, disputes, settlement reports — gets a 200 and
   * is dropped. A non-2xx would make Razorpay retry an event we are never
   * going to act on, for days.
   */
  if (!event.event || !PAID_EVENTS.has(event.event)) {
    return NextResponse.json({ ignored: event.event ?? null });
  }

  const payment = event.payload?.payment?.entity ?? {};
  const providerOrderId = payment.order_id ?? event.payload?.order?.entity?.id;

  if (!providerOrderId) {
    return NextResponse.json({ error: "No order id" }, { status: 400 });
  }

  const [row] = await db
    .select({
      orderId: payments.orderId,
      amountMinor: payments.amountMinor,
      currency: payments.currency,
    })
    .from(payments)
    .where(eq(payments.providerOrderId, providerOrderId))
    .limit(1);

  if (!row) {
    // A signed event for an order we have no record of. Retrying will not make
    // it appear, so this is a 200 with a log rather than an error.
    console.warn("[razorpay-webhook] no payment row for", providerOrderId);
    return NextResponse.json({ ignored: "unknown order" });
  }

  /**
   * What was actually paid has to match what was owed. The signature proves
   * Razorpay sent this, not that it settles the order — without this check a
   * genuine 1p payment against a £300 order would mark it paid in full.
   *
   * order.paid carries no payment amount, so this only applies when one is
   * present; that event is only sent once the order is fully paid anyway.
   */
  if (payment.amount !== undefined && payment.amount !== row.amountMinor) {
    console.error(
      "[razorpay-webhook] amount mismatch on",
      providerOrderId,
      `paid ${payment.amount}, owed ${row.amountMinor}`,
    );
    return NextResponse.json({ error: "Amount mismatch" }, { status: 409 });
  }

  if (
    payment.currency &&
    payment.currency.toUpperCase() !== row.currency.toUpperCase()
  ) {
    console.error("[razorpay-webhook] currency mismatch on", providerOrderId);
    return NextResponse.json({ error: "Currency mismatch" }, { status: 409 });
  }

  // Anything thrown below is a genuine failure on our side. Letting it become
  // a 500 is deliberate: Razorpay retries, which is exactly what we want.
  const outcome = await markOrderPaid(
    row.orderId,
    "razorpay",
    payment.id ?? null,
    event as Record<string, unknown>,
  );

  return NextResponse.json({ outcome });
}
