"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, payments, users } from "@/db/schema";
import { z } from "zod";
import { fieldErrors } from "@/lib/validation";
import { nextOrderReference } from "@/lib/order-reference";
import { requireUser } from "@/lib/auth/guards";
import { clearCart, getCartContents, getOwnCartId } from "@/lib/cart/cart";
import { fail, type FormState } from "@/lib/auth/form-state";
import { razorpay } from "./razorpay";
import { paypal } from "./paypal";
import { markOrderPaid } from "./settle";
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

/**
 * Turns the current cart into an order.
 *
 * Nothing is charged here. The studio draws a proof first, the customer
 * approves it, and only then is there anything to pay for — so a new order
 * starts at awaiting_proof with nothing owed yet.
 *
 * Line prices are not frozen: each line keeps the key it was bought under and
 * the total is re-derived on display, so a catalogue correction reaches the
 * order without anyone re-keying it. Once the order is paid, repricing stops.
 */
export async function createOrderFromCart(orderedFor?: string | null): Promise<{
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

  /**
   * The delivery address is copied from the profile, not pointed at it.
   *
   * Most of these orders come from funeral directors ordering for a family,
   * so the address is nearly always the one already on their account — but it
   * is taken as a copy, because an order that is already in production must
   * not quietly change destination when someone edits their profile months
   * later. The copy can be edited per order for the times it differs.
   */
  const [profile] = await db
    .select({
      name: users.name,
      addressLine1: users.addressLine1,
      addressLine2: users.addressLine2,
      city: users.city,
      postcode: users.postcode,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const [order] = await db
    .insert(orders)
    .values({
      reference,
      orderedFor: orderedFor?.trim().slice(0, 200) || null,
      userId: session.user.id,
      status: "awaiting_proof",
      paymentStatus: "unpaid",
      totalMinor: total.amountMinor,
      currency: total.currency,
      placedAt: new Date(),
      shippingName: profile?.name ?? null,
      shippingLine1: profile?.addressLine1 ?? null,
      shippingLine2: profile?.addressLine2 ?? null,
      shippingCity: profile?.city ?? null,
      shippingPostcode: profile?.postcode ?? null,
      shippingCountry: profile?.country ?? null,
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

/**
 * Places the order. No money changes hands.
 *
 * This used to create the order and send the customer straight to the payment
 * sheet. It no longer does: the proof comes first, and payment is asked for
 * once the customer has approved what they are paying for. That is the whole
 * point of the change — nobody pays for stationery they have not seen.
 */
export async function placeOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Redirects an anonymous caller before any order is created.
  await requireUser();

  const created = await createOrderFromCart(
    String(formData.get("orderedFor") ?? ""),
  );
  if (!created) {
    return fail(
      "That cart can't be checked out as it stands. Ask us for a quote and we'll price it for you.",
    );
  }

  revalidatePath("/cart");
  revalidatePath("/account/orders");

  redirect(`/checkout/${created.orderId}`);
}

/**
 * Starts a payment attempt against an order that is already approved.
 *
 * Guarded on the order's own status rather than on what the form posts: an
 * order that has not reached awaiting_payment has not been approved by its
 * customer, and asking them to pay for it would be asking for money for work
 * they have not agreed to.
 */
export async function beginPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();

  const providerName = String(formData.get("provider") ?? "") as ProviderName;
  const provider = PROVIDERS[providerName];
  if (!provider) return fail("Choose a payment method.");

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return fail("Missing order.");

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) return fail("Order not found.");
  if (order.paymentStatus === "paid") return fail("This order is already paid.");
  if (order.status !== "awaiting_payment") {
    return fail("This order isn't ready for payment yet.");
  }
  if (order.totalMinor === null) {
    return fail("This order hasn't been priced yet.");
  }

  let providerOrder;
  try {
    providerOrder = await provider.createOrder({
      orderReference: order.reference,
      amountMinor: order.totalMinor,
      currency: order.currency,
    });
  } catch (error) {
    console.error("[payments] createOrder failed", error);
    return fail(
      "We couldn't reach the payment provider. Your order is safe — please try again.",
    );
  }

  await db.insert(payments).values({
    orderId: order.id,
    provider: providerName,
    providerOrderId: providerOrder.providerOrderId,
    amountMinor: order.totalMinor,
    currency: order.currency,
    status: "created",
  });

  revalidatePath("/account/orders");

  redirect(
    `/checkout/${order.id}?provider=${providerName}${
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

  await markOrderPaid(orderId, providerName, result.providerPaymentId, payload);

  return { ok: true, message: "Payment received." };
}

/**
 * The delivery address for a single order.
 *
 * Writes only to the order, never back to the profile: a one-off delivery to
 * a family's home should not become the funeral director's own address for
 * everything afterwards.
 *
 * Editable until the parcel is on its way. After that the address on the
 * order is a record of where it actually went, and changing it would be
 * rewriting history rather than redirecting anything.
 */
const addressSchema = z.object({
  shippingName: z.string().trim().min(1, "Who should it be addressed to?").max(200),
  shippingLine1: z.string().trim().min(1, "Enter the first line of the address.").max(200),
  shippingLine2: z.string().trim().max(200).optional(),
  shippingCity: z.string().trim().min(1, "Enter the town or city.").max(120),
  shippingPostcode: z.string().trim().min(1, "Enter the postcode.").max(20),
  shippingCountry: z.string().trim().max(120).optional(),
});

export async function saveOrderAddressAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireUser();

  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return fail("Missing order.");

  const parsed = addressSchema.safeParse({
    shippingName: formData.get("shippingName"),
    shippingLine1: formData.get("shippingLine1"),
    shippingLine2: formData.get("shippingLine2"),
    shippingCity: formData.get("shippingCity"),
    shippingPostcode: formData.get("shippingPostcode"),
    shippingCountry: formData.get("shippingCountry"),
  });

  if (!parsed.success) {
    return fail("Please check the address.", fieldErrors(parsed.error));
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) return fail("Order not found.");

  if (
    order.status === "shipped" ||
    order.status === "delivered" ||
    order.status === "cancelled"
  ) {
    return fail(
      "This order has already been sent. Call the studio if the address is wrong.",
    );
  }

  const blankToNull = (value?: string) => (value?.trim() ? value.trim() : null);

  await db
    .update(orders)
    .set({
      shippingName: parsed.data.shippingName,
      shippingLine1: parsed.data.shippingLine1,
      shippingLine2: blankToNull(parsed.data.shippingLine2),
      shippingCity: parsed.data.shippingCity,
      shippingPostcode: parsed.data.shippingPostcode,
      shippingCountry: blankToNull(parsed.data.shippingCountry),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, order.id));

  revalidatePath(`/checkout/${order.id}`);
  revalidatePath("/account/orders");

  return { ok: true, message: "Delivery address saved." };
}
