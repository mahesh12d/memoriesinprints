"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, payments } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { clearCart, getCartContents, getOwnCartId } from "@/lib/cart/cart";
import { fail, type FormState } from "@/lib/auth/form-state";
import { razorpay } from "./razorpay";
import { paypal } from "./paypal";
import type { PaymentProvider, ProviderName } from "./provider";

const PROVIDERS: Record<ProviderName, PaymentProvider> = {
  razorpay,
  paypal,
};

export async function providerStatus(): Promise<
  { name: ProviderName; configured: boolean }[]
> {
  return (Object.keys(PROVIDERS) as ProviderName[]).map((name) => ({
    name,
    configured: PROVIDERS[name].isConfigured(),
  }));
}

async function nextOrderReference(): Promise<string> {
  const [row] = await db
    .select({
      next: sql<number>`coalesce(max(nullif(regexp_replace(${orders.reference}, '\\D', '', 'g'), '')::int), 1000) + 1`,
    })
    .from(orders);

  return `MP-${row?.next ?? 1001}`;
}

/**
 * Turns the current cart into an order.
 *
 * Line prices are not frozen: each line keeps the key it was bought under and
 * the total is re-derived on display, so a catalogue correction reaches the
 * order without anyone re-keying it. Once the order is paid, repricing stops.
 */
export async function createOrderFromCart(): Promise<{
  orderId: string;
  reference: string;
  amountMinor: number;
  currency: string;
} | null> {
  const session = await requireUser();
  const cart = await getCartContents();

  if (
    cart.lines.length === 0 ||
    cart.hasUnpricedItems ||
    cart.isMixedCurrency ||
    cart.totals.length !== 1
  ) {
    return null;
  }

  const total = cart.totals[0];
  const reference = await nextOrderReference();

  const [order] = await db
    .insert(orders)
    .values({
      reference,
      userId: session.user.id,
      status: "awaiting_payment",
      paymentStatus: "unpaid",
      totalMinor: total.amountMinor,
      currency: total.currency,
      placedAt: new Date(),
    })
    .returning({ id: orders.id });

  await db.insert(orderItems).values(
    cart.lines.map((line) => ({
      orderId: order.id,
      itemKey: line.itemKey,
      productId: line.item?.productId ?? null,
      productSizeId: line.item?.productSizeId ?? null,
      nameSnapshot: line.item?.name ?? line.itemKey,
      sizeSnapshot: line.item?.sizeLabel ?? null,
      quantity: line.quantity,
      unitPriceMinor: line.item?.price?.amountMinor ?? null,
      lineTotalMinor: line.lineTotalMinor,
    })),
  );

  const cartId = await getOwnCartId();
  if (cartId) await clearCart(cartId);

  return {
    orderId: order.id,
    reference,
    amountMinor: total.amountMinor,
    currency: total.currency,
  };
}

/** Starts a payment attempt with the chosen provider. */
export async function beginPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Redirects an anonymous caller before any order is created.
  await requireUser();

  const providerName = String(formData.get("provider") ?? "") as ProviderName;
  const provider = PROVIDERS[providerName];
  if (!provider) return fail("Choose a payment method.");

  const created = await createOrderFromCart();
  if (!created) {
    return fail(
      "That cart can't be checked out as it stands. Ask us for a quote and we'll price it for you.",
    );
  }

  let providerOrder;
  try {
    providerOrder = await provider.createOrder({
      orderReference: created.reference,
      amountMinor: created.amountMinor,
      currency: created.currency,
    });
  } catch (error) {
    console.error("[payments] createOrder failed", error);
    return fail(
      "We couldn't reach the payment provider. Your order is saved — try again from your account.",
    );
  }

  await db.insert(payments).values({
    orderId: created.orderId,
    provider: providerName,
    providerOrderId: providerOrder.providerOrderId,
    amountMinor: created.amountMinor,
    currency: created.currency,
    status: "created",
  });

  revalidatePath("/cart");
  revalidatePath("/account/orders");

  // With no credentials yet there is nothing to open, so the person lands on a
  // page that says plainly that the order exists but payment isn't live.
  redirect(
    `/checkout/${created.orderId}?provider=${providerName}${
      providerOrder.isStub ? "&stub=1" : ""
    }`,
  );
}

/**
 * Confirms a payment attempt. Whether an order is paid is decided by the
 * provider's own response, never by what the browser posts back.
 */
export async function confirmPaymentAction(
  orderId: string,
  providerName: ProviderName,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> {
  const session = await requireUser();
  const provider = PROVIDERS[providerName];

  if (!provider) return { ok: false, message: "Unknown payment method." };

  const [order] = await db
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) return { ok: false, message: "Order not found." };
  if (order.paymentStatus === "paid") {
    return { ok: true, message: "This order is already paid." };
  }

  const result = await provider.verify(payload);

  if (!result.ok) {
    await db
      .update(payments)
      .set({ status: "failed", rawPayload: payload, updatedAt: new Date() })
      .where(
        and(
          eq(payments.orderId, orderId),
          eq(payments.provider, providerName),
        ),
      );

    return {
      ok: false,
      message: result.reason ?? "That payment could not be confirmed.",
    };
  }

  await db
    .update(payments)
    .set({
      status: "captured",
      providerPaymentId: result.providerPaymentId,
      rawPayload: payload,
      updatedAt: new Date(),
    })
    .where(
      and(eq(payments.orderId, orderId), eq(payments.provider, providerName)),
    );

  await db
    .update(orders)
    .set({
      paymentStatus: "paid",
      status: "awaiting_proof",
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  revalidatePath("/account/orders");

  return { ok: true, message: "Payment received." };
}
