"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityEvents, notifications, orders, payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import { formatMoney, majorToMinor } from "@/lib/pricing/money";
import { ORDER_STATUS } from "@/lib/admin/labels";

const ORDER_STATUSES = [
  "awaiting_price",
  "awaiting_payment",
  "awaiting_proof",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const detailSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  assignedDesignerId: z.string().uuid().nullable(),
  paperStock: z.string().trim().max(120).nullable(),
  finish: z.string().trim().max(120).nullable(),
  printMethod: z.string().trim().max(120).nullable(),
  productionNotes: z.string().trim().max(4000).nullable(),
  internalNotes: z.string().trim().max(4000).nullable(),
});

/** Empty form fields mean "not set", not an empty string in the database. */
function blankToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

/**
 * Saves the order and, when the status moved, tells the customer.
 *
 * Statuses the customer doesn't care about — an internal note, a designer
 * swap — pass silently. Shipped and delivered are worth an interruption.
 */
export async function updateOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = detailSchema.safeParse({
    orderId: formData.get("orderId"),
    status: formData.get("status"),
    assignedDesignerId: blankToNull(formData.get("assignedDesignerId")),
    paperStock: blankToNull(formData.get("paperStock")),
    finish: blankToNull(formData.get("finish")),
    printMethod: blankToNull(formData.get("printMethod")),
    productionNotes: blankToNull(formData.get("productionNotes")),
    internalNotes: blankToNull(formData.get("internalNotes")),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That didn't save.");
  }

  const { orderId, status, ...rest } = parsed.data;

  const [before] = await db
    .select({
      status: orders.status,
      reference: orders.reference,
      userId: orders.userId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!before) return fail("That order no longer exists.");

  await db
    .update(orders)
    .set({ status, ...rest, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  if (before.status !== status) {
    await db.insert(activityEvents).values({
      orderId,
      actorId: session.user.id,
      type: "order_status",
      summary: `${before.reference} moved to ${ORDER_STATUS[status]?.label ?? status}`,
    });

    if (status === "shipped" || status === "delivered") {
      await db.insert(notifications).values({
        userId: before.userId,
        type: "order_status",
        title:
          status === "shipped"
            ? `${before.reference} is on its way`
            : `${before.reference} has been delivered`,
        body:
          status === "shipped"
            ? "Your order has left the studio."
            : "Let us know if anything isn't right.",
        linkUrl: "/account/orders",
      });
    }
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/staff/queue");

  return { ok: true, message: "Order saved." };
}

const paymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter the amount received."),
  provider: z.enum(["razorpay", "paypal"]),
  providerPaymentId: z.string().trim().max(200).optional(),
});

/**
 * Records a payment taken outside the website — a bank transfer, a card
 * machine in the shop, cash at the counter.
 *
 * It writes a payment row as well as setting the order to paid, so the money
 * is traceable rather than appearing as a status that changed itself. Marking
 * an order paid also stops the repricer touching it, which is the behaviour
 * we want: what was paid is what was agreed.
 */
export async function recordPaymentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = paymentSchema.safeParse({
    orderId: formData.get("orderId"),
    amount: formData.get("amount"),
    provider: formData.get("provider"),
    providerPaymentId: formData.get("providerPaymentId") || undefined,
  });

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "That payment didn't look right.",
    );
  }

  const { orderId, amount, provider, providerPaymentId } = parsed.data;

  const [order] = await db
    .select({
      reference: orders.reference,
      currency: orders.currency,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return fail("That order no longer exists.");
  if (order.paymentStatus === "paid") {
    return fail("This order is already marked paid.");
  }

  const amountMinor = majorToMinor(amount, order.currency);

  await db.insert(payments).values({
    orderId,
    provider,
    providerPaymentId: providerPaymentId ?? null,
    amountMinor,
    currency: order.currency,
    status: "captured",
  });

  await db
    .update(orders)
    .set({ paymentStatus: "paid", updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await db.insert(activityEvents).values({
    orderId,
    actorId: session.user.id,
    type: "payment_recorded",
    summary: `${formatMoney(amountMinor, order.currency)} recorded against ${order.reference}`,
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);

  return { ok: true, message: "Payment recorded." };
}
