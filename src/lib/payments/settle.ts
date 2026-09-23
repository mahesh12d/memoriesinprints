import "server-only";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments, users } from "@/db/schema";
import { sendMail } from "@/lib/mail/mailer";
import { paymentReceivedMail } from "@/lib/mail/templates";
import type { ProviderName } from "./provider";

/**
 * Marking an order paid, from whichever direction the news arrives.
 *
 * Two things can report a successful payment: the customer's browser coming
 * back from the provider, and the provider's own webhook. They must do exactly
 * the same thing, so they call exactly the same function — a second copy of
 * this logic is how "paid in Razorpay, unpaid in our database" starts.
 */

export type SettleResult = "paid" | "already-paid" | "not-found";

export async function markOrderPaid(
  orderId: string,
  provider: ProviderName,
  providerPaymentId: string | null,
  rawPayload: Record<string, unknown>,
): Promise<SettleResult> {
  const [order] = await db
    .select({
      paymentStatus: orders.paymentStatus,
      reference: orders.reference,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return "not-found";
  if (order.paymentStatus === "paid") return "already-paid";

  await db
    .update(payments)
    .set({
      status: "captured",
      providerPaymentId,
      rawPayload,
      updatedAt: new Date(),
    })
    .where(and(eq(payments.orderId, orderId), eq(payments.provider, provider)));

  /**
   * The ne() is the idempotency guard, and it is not the same as the check
   * above. Razorpay retries a webhook it thinks failed, and a customer can be
   * redirected back at the same moment, so two deliveries can pass that check
   * together. Letting Postgres decide who wins means the loser updates nothing
   * rather than re-running the transition.
   */
  const updated = await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "in_production",
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, orderId), ne(orders.paymentStatus, "paid")))
    .returning({ id: orders.id });

  if (updated.length === 0) return "already-paid";

  /**
   * The receipt goes out only from the branch that actually made the change,
   * which is what stops a webhook retry arriving at the same time as the
   * browser and sending the customer two receipts for one payment.
   *
   * A failure here must not fail the settlement: the money is taken and the
   * order is marked paid. Throwing would hand Razorpay a 500 and invite it to
   * redeliver a payment we have already recorded.
   */
  try {
    await sendMail(
      paymentReceivedMail(
        order.customerEmail,
        order.customerName,
        order.reference,
        orderId,
        order.totalMinor,
        order.currency,
      ),
    );
  } catch (error) {
    console.error("[payments] could not email the receipt", error);
  }

  revalidatePath("/account/orders");

  return "paid";
}
