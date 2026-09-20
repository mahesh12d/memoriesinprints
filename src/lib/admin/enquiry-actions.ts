"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityEvents, enquiries, notifications, orders } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import { majorToMinor } from "@/lib/pricing/money";

const statusSchema = z.object({
  enquiryId: z.string().uuid(),
  status: z.enum([
    "new",
    "reviewed",
    "quoted",
    "converted",
    "declined",
    "cancelled",
  ]),
});

export async function setEnquiryStatusAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = statusSchema.safeParse({
    enquiryId: formData.get("enquiryId"),
    status: formData.get("status"),
  });

  if (!parsed.success) return fail("That status isn't one we recognise.");

  await db
    .update(enquiries)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(eq(enquiries.id, parsed.data.enquiryId));

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${parsed.data.enquiryId}`);

  return { ok: true, message: "Status updated." };
}

const quoteSchema = z.object({
  enquiryId: z.string().uuid(),
  amount: z.coerce.number().positive("Enter the amount you're quoting."),
  notes: z.string().trim().max(2000).optional(),
});

/**
 * Records a quote against an enquiry and tells the customer.
 *
 * The customer is only notified when the enquiry belongs to an account — an
 * enquiry from a logged-out visitor has nowhere to show a notification, and
 * they are followed up by email instead.
 */
export async function quoteEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const parsed = quoteSchema.safeParse({
    enquiryId: formData.get("enquiryId"),
    amount: formData.get("amount"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message ?? "That quote didn't look right.",
    );
  }

  const { enquiryId, amount, notes } = parsed.data;

  const [enquiry] = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      userId: enquiries.userId,
    })
    .from(enquiries)
    .where(eq(enquiries.id, enquiryId))
    .limit(1);

  if (!enquiry) return fail("That enquiry no longer exists.");

  await db
    .update(enquiries)
    .set({
      status: "quoted",
      quotedAmountMinor: majorToMinor(amount, "GBP"),
      quotedAt: new Date(),
      quoteNotes: notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(enquiries.id, enquiryId));

  if (enquiry.userId) {
    await db.insert(notifications).values({
      userId: enquiry.userId,
      type: "quote_update",
      title: `We've quoted for ${enquiry.reference}`,
      body: notes ?? "Have a look and let us know how you'd like to proceed.",
      linkUrl: "/account/quotes",
    });
  }

  await db.insert(activityEvents).values({
    actorId: session.user.id,
    type: "enquiry_quoted",
    summary: `${session.user.name} quoted ${enquiry.reference}`,
  });

  revalidatePath("/admin/enquiries");
  revalidatePath(`/admin/enquiries/${enquiryId}`);

  return { ok: true, message: "Quote recorded and the customer told." };
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
 * Turns a quoted enquiry into an order.
 *
 * Only possible once the enquiry belongs to an account, because an order has
 * to have an owner who can approve the proof and pay for it. The quoted figure
 * becomes the order total, and the enquiry is marked converted so it can't be
 * turned into a second order by accident.
 */
export async function convertEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireAdmin();

  const enquiryId = String(formData.get("enquiryId") ?? "");
  if (!z.string().uuid().safeParse(enquiryId).success) {
    return fail("That enquiry isn't one we recognise.");
  }

  const [enquiry] = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      subject: enquiries.subject,
      userId: enquiries.userId,
      status: enquiries.status,
      quotedAmountMinor: enquiries.quotedAmountMinor,
      quantity: enquiries.estimatedQuantity,
    })
    .from(enquiries)
    .where(eq(enquiries.id, enquiryId))
    .limit(1);

  if (!enquiry) return fail("That enquiry no longer exists.");

  if (enquiry.status === "converted") {
    return fail("This enquiry has already become an order.");
  }

  if (!enquiry.userId) {
    return fail(
      "This enquiry came from a visitor with no account, so there's nobody to own the order. Ask them to sign up first.",
    );
  }

  const reference = await nextOrderReference();

  const [order] = await db
    .insert(orders)
    .values({
      reference,
      userId: enquiry.userId,
      enquiryId: enquiry.id,
      status: enquiry.quotedAmountMinor ? "awaiting_payment" : "awaiting_price",
      paymentStatus: "unpaid",
      totalMinor: enquiry.quotedAmountMinor,
      currency: "GBP",
      placedAt: new Date(),
    })
    .returning({ id: orders.id });

  await db
    .update(enquiries)
    .set({ status: "converted", updatedAt: new Date() })
    .where(eq(enquiries.id, enquiryId));

  await db.insert(activityEvents).values({
    orderId: order.id,
    actorId: session.user.id,
    type: "enquiry_converted",
    summary: `${reference} raised from enquiry ${enquiry.reference}`,
  });

  await db.insert(notifications).values({
    userId: enquiry.userId,
    type: "order_status",
    title: `Your order ${reference} is open`,
    body: "We've turned your enquiry into an order. You can follow it from your account.",
    linkUrl: "/account/orders",
  });

  revalidatePath("/admin/enquiries");
  revalidatePath("/admin/orders");

  redirect(`/admin/orders/${order.id}`);
}
