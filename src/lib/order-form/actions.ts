"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orderForms, orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import {
  additionalProductSchema,
  MAX,
  missingForSubmission,
  orderFormSchema,
} from "./schema";

/**
 * Saves the order form.
 *
 * Saving is always an upsert on the unique order id. Two tabs, a double click
 * or a retry after a dropped connection all land on the same row rather than
 * quietly creating a second form the studio would never think to look for.
 */
/**
 * The uploaded files, as the client posts them.
 *
 * Sent as one JSON field rather than indexed inputs: the list is built in the
 * browser as each upload finishes, so it arrives as a unit or not at all.
 */
function readAttachments(formData: FormData): unknown {
  const raw = formData.get("attachments");
  if (typeof raw !== "string" || raw === "") return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOrderFormAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  /**
   * Keyed on the order, and guarded on who is asking.
   *
   * This used to take an enquiry id from the form and trust it: anyone who
   * guessed or was forwarded a link could read and overwrite another family's
   * details. Orders belong to an account, so ownership can actually be
   * checked, and it is checked here rather than only on the page, because the
   * action is reachable on its own.
   */
  const session = await requireUser();

  const orderId = String(formData.get("orderId") ?? "");
  if (!z.string().uuid().safeParse(orderId).success) {
    return fail("That link doesn't look right.");
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, reference: orders.reference })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) {
    return fail("We couldn't find that order.");
  }

  const submitting = formData.get("intent") === "submit";

  const parsed = orderFormSchema.safeParse({
    branchName: formData.get("branchName") ?? "",
    arrangerName: formData.get("arrangerName") ?? "",

    deceasedName: formData.get("deceasedName") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    dateOfDeath: formData.get("dateOfDeath") ?? "",
    ageOfDeceased: formData.get("ageOfDeceased") ?? "",

    funeralDate: formData.get("funeralDate") ?? "",
    funeralTime: formData.get("funeralTime") ?? "",
    venueName: formData.get("venueName") ?? "",

    coverDesignCode: formData.get("coverDesignCode") ?? "",
    insidePagesCode: formData.get("insidePagesCode") ?? "",
    photoOption: formData.get("photoOption") ?? "",
    numberOfPages: formData.get("numberOfPages") ?? "",
    insidePagesStyle: formData.get("insidePagesStyle") ?? "",
    quantity: formData.get("quantity") ?? "",
    bespokeDesign: formData.get("bespokeDesign") === "on",
    bespokeDetails: formData.get("bespokeDetails") ?? "",

    photoQty: formData.get("photoQty") ?? "",
    photoInstructions: formData.get("photoInstructions") ?? "",
    attachments: readAttachments(formData),

    additionalProducts: readProducts(formData),
    backpageInformation: formData.get("backpageInformation") ?? "",
    additionalNotes: formData.get("additionalNotes") ?? "",
    callbackRequested: formData.get("callbackRequested") === "on",
    callbackPhone: formData.get("callbackPhone") ?? "",

    shippingName: formData.get("shippingName") ?? "",
    shippingLine1: formData.get("shippingLine1") ?? "",
    shippingLine2: formData.get("shippingLine2") ?? "",
    shippingCity: formData.get("shippingCity") ?? "",
    shippingPostcode: formData.get("shippingPostcode") ?? "",
    shippingCountry: formData.get("shippingCountry") ?? "",
  });

  if (!parsed.success) {
    // Errors go back keyed by field so each one can sit beside its own input
    // rather than in a list at the top of a long form.
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !errors[key]) errors[key] = issue.message;
    }

    return fail("Some answers need a look — they're marked below.", errors);
  }

  const values = parsed.data;

  if (submitting) {
    const missing = missingForSubmission(values);
    if (Object.keys(missing).length > 0) {
      return fail(
        "Almost there — we just need a delivery address before this can go to the studio.",
        missing,
      );
    }
  }

  const now = new Date();

  // A checkbox that is off makes its revealed field meaningless, so it is
  // cleared rather than left behind where nobody can see or correct it.
  const bespokeDetails = values.bespokeDesign ? values.bespokeDetails : null;
  const callbackPhone = values.callbackRequested ? values.callbackPhone : null;

  await db
    .insert(orderForms)
    .values({
      orderId,
      ...values,
      bespokeDetails,
      callbackPhone,
      status: submitting ? "submitted" : "draft",
      submittedAt: submitting ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: orderForms.orderId,
      set: {
        ...values,
        bespokeDetails,
        callbackPhone,
        status: submitting ? "submitted" : "draft",
        submittedAt: submitting ? now : null,
        updatedAt: now,
      },
    });

  /**
   * Sending the form is what hands the job to the studio.
   *
   * The address is copied onto the order as well as kept on the form: the
   * order is what production and delivery read, and it should not have to
   * join through a form to find out where a parcel goes.
   */
  if (submitting) {
    await db
      .update(orders)
      .set({
        shippingName: values.shippingName,
        shippingLine1: values.shippingLine1,
        shippingLine2: values.shippingLine2,
        shippingCity: values.shippingCity,
        shippingPostcode: values.shippingPostcode,
        shippingCountry: values.shippingCountry,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));
  }

  revalidatePath(`/order-form/${orderId}`);
  revalidatePath("/account/orders");
  revalidatePath("/staff/queue");

  /**
   * A sent form is the end of this page, so it ends on the dashboard.
   *
   * Left here, someone has filled in the longest form on the site and is
   * looking at a page with nothing on it and nowhere to go. The confirmation
   * travels with them and is shown once at the top of the dashboard, next to
   * the order it belongs to.
   */
  if (submitting) {
    revalidatePath("/account");
    redirect(`/account?sent=${encodeURIComponent(order.reference)}`);
  }

  return {
    ok: true,
    message: "Saved. You can come back to this link whenever you're ready.",
  };
}


/**
 * Reads the repeated product rows.
 *
 * They arrive as parallel lists rather than an object per row, because that
 * is what a plain multipart form can express without JavaScript assembling
 * it first.
 */
function readProducts(formData: FormData) {
  const slugs = formData.getAll("productSlug").map(String);
  const titles = formData.getAll("productTitle").map(String);
  const sizes = formData.getAll("productSize").map(String);
  const quantities = formData.getAll("productQuantity").map(String);

  return slugs
    .slice(0, MAX.products)
    .map((slug, index) => ({
      slug,
      title: titles[index] ?? "",
      size: sizes[index] ?? "",
      quantity: quantities[index] ?? "1",
    }))
    .filter((row) => row.slug.trim() !== "")
    .map((row) => additionalProductSchema.safeParse(row))
    .flatMap((result) => (result.success ? [result.data] : []));
}
