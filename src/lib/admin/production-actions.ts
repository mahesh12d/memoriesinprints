"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityEvents, notifications, orderItems, orders, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import { majorToMinor } from "@/lib/pricing/money";

const schema = z.object({
  customerId: z.string().uuid("Choose the customer this is for."),
  description: z.string().trim().min(2, "Say what is being printed."),
  quantity: z.coerce.number().int().positive("How many are we printing?"),
  amount: z.coerce.number().nonnegative().optional(),
  assignedDesignerId: z.string().uuid().nullable(),
  paperStock: z.string().trim().max(120).nullable(),
  finish: z.string().trim().max(120).nullable(),
  productionNotes: z.string().trim().max(4000).nullable(),
});

function blankToNull(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
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
 * Raises an order that never came through the website.
 *
 * Most funeral work starts on the phone or at the counter — a director rings
 * with a date and a number of booklets, and the studio needs the job in the
 * system before a proof can be uploaded against it. The line carries no item
 * key, so the repricer leaves it alone: the figure typed here is the figure
 * that stands.
 */
export async function createProductionOrderAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireStaff();

  const parsed = schema.safeParse({
    customerId: formData.get("customerId"),
    description: formData.get("description"),
    quantity: formData.get("quantity"),
    amount: formData.get("amount") || undefined,
    assignedDesignerId: blankToNull(formData.get("assignedDesignerId")),
    paperStock: blankToNull(formData.get("paperStock")),
    finish: blankToNull(formData.get("finish")),
    productionNotes: blankToNull(formData.get("productionNotes")),
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That order didn't save.");
  }

  const data = parsed.data;

  const [customer] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.id, data.customerId))
    .limit(1);

  if (!customer) return fail("That customer no longer exists.");

  const totalMinor =
    data.amount === undefined ? null : majorToMinor(data.amount, "GBP");

  const reference = await nextOrderReference();

  const [order] = await db
    .insert(orders)
    .values({
      reference,
      userId: customer.id,
      status: totalMinor === null ? "awaiting_price" : "awaiting_proof",
      paymentStatus: "unpaid",
      totalMinor,
      currency: "GBP",
      assignedDesignerId: data.assignedDesignerId,
      paperStock: data.paperStock,
      finish: data.finish,
      productionNotes: data.productionNotes,
      placedAt: new Date(),
    })
    .returning({ id: orders.id });

  await db.insert(orderItems).values({
    orderId: order.id,
    // No item key: this line isn't from the catalogue, so the repricer skips
    // it and the figure entered here is the one that stands.
    itemKey: null,
    nameSnapshot: data.description,
    quantity: data.quantity,
    unitPriceMinor:
      totalMinor === null ? null : Math.round(totalMinor / data.quantity),
    lineTotalMinor: totalMinor,
  });

  await db.insert(activityEvents).values({
    orderId: order.id,
    actorId: session.user.id,
    type: "order_raised",
    summary: `${session.user.name} raised ${reference} for ${customer.name}`,
  });

  await db.insert(notifications).values({
    userId: customer.id,
    type: "order_status",
    title: `Your order ${reference} is open`,
    body: "We've set up your order. You'll hear from us when a proof is ready.",
    linkUrl: "/account/orders",
  });

  revalidatePath("/staff/orders");
  revalidatePath("/staff/queue");
  revalidatePath("/admin/orders");

  redirect(`/staff/orders/${order.id}`);
}
