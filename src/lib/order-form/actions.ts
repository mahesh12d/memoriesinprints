"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { enquiries, orderForms } from "@/db/schema";
import { fail, type FormState } from "@/lib/auth/form-state";
import {
  additionalProductSchema,
  MAX,
  orderFormSchema,
} from "./schema";

/**
 * Saves the order form.
 *
 * The enquiry id in the link is the only credential, so it is checked against
 * a real enquiry on every save — a made-up id gets the same nothing a missing
 * one does.
 *
 * Saving is always an upsert on the unique enquiry id. Two tabs, a double
 * click or a retry after a dropped connection all land on the same row rather
 * than quietly creating a second form the studio would never think to look
 * for.
 */
export async function saveOrderFormAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const enquiryId = String(formData.get("enquiryId") ?? "");
  if (!z.string().uuid().safeParse(enquiryId).success) {
    return fail("That link doesn't look right. Please use the one we sent you.");
  }

  const [enquiry] = await db
    .select({ id: enquiries.id })
    .from(enquiries)
    .where(eq(enquiries.id, enquiryId))
    .limit(1);

  if (!enquiry) {
    return fail("That link doesn't look right. Please use the one we sent you.");
  }

  const submitting = formData.get("intent") === "submit";

  const parsed = orderFormSchema.safeParse({
    deceasedName: formData.get("deceasedName") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    dateOfDeath: formData.get("dateOfDeath") ?? "",
    ageOfDeceased: formData.get("ageOfDeceased") ?? "",

    funeralDate: formData.get("funeralDate") ?? "",
    funeralTime: formData.get("funeralTime") ?? "",
    venueName: formData.get("venueName") ?? "",

    photoOption: formData.get("photoOption") ?? "",
    numberOfPages: formData.get("numberOfPages") ?? "",
    insidePagesStyle: formData.get("insidePagesStyle") ?? "",
    quantity: formData.get("quantity") ?? "",
    bespokeDesign: formData.get("bespokeDesign") === "on",
    bespokeDetails: formData.get("bespokeDetails") ?? "",

    photoQty: formData.get("photoQty") ?? "",
    photoSuppliedVia: formData.get("photoSuppliedVia") ?? "",
    photoInstructions: formData.get("photoInstructions") ?? "",
    attachmentKey: readOptional(formData.get("attachmentKey")),
    attachmentName: readOptional(formData.get("attachmentName")),

    additionalProducts: readProducts(formData),
    backpageInformation: formData.get("backpageInformation") ?? "",
    additionalNotes: formData.get("additionalNotes") ?? "",
    callbackRequested: formData.get("callbackRequested") === "on",
    callbackPhone: formData.get("callbackPhone") ?? "",
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
  const now = new Date();

  // A checkbox that is off makes its revealed field meaningless, so it is
  // cleared rather than left behind where nobody can see or correct it.
  const bespokeDetails = values.bespokeDesign ? values.bespokeDetails : null;
  const callbackPhone = values.callbackRequested ? values.callbackPhone : null;

  await db
    .insert(orderForms)
    .values({
      enquiryId,
      ...values,
      bespokeDetails,
      callbackPhone,
      status: submitting ? "submitted" : "draft",
      submittedAt: submitting ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: orderForms.enquiryId,
      set: {
        ...values,
        bespokeDetails,
        callbackPhone,
        status: submitting ? "submitted" : "draft",
        submittedAt: submitting ? now : null,
        updatedAt: now,
      },
    });

  revalidatePath(`/order-form/${enquiryId}`);

  return {
    ok: true,
    message: submitting
      ? "Order form received."
      : "Saved. You can come back to this link whenever you're ready.",
  };
}

function readOptional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
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
