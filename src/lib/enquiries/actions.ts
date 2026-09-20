"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, notifications } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { sendMail } from "@/lib/mail/mailer";
import {
  enquiryReceivedMail,
  studioEnquiryMail,
} from "@/lib/mail/templates";
import { STUDIO } from "@/lib/studio";
import { fail, type FormState } from "@/lib/auth/form-state";
import { enquirySchema } from "./schema";
import { fieldErrors } from "@/lib/validation";

/**
 * References are human-facing — people read them out on the phone — so they're
 * sequential rather than a UUID.
 *
 * Two submissions landing at once can read the same maximum, so the insert is
 * retried on the unique-constraint violation rather than pretending the read is
 * atomic. At this volume that collision is rare; the retry makes it harmless.
 */
async function nextReference(): Promise<string> {
  const [row] = await db
    .select({
      next: sql<number>`coalesce(max(nullif(regexp_replace(${enquiries.reference}, '\\D', '', 'g'), '')::int), 1000) + 1`,
    })
    .from(enquiries);

  return `ENQ-${row?.next ?? 1001}`;
}

function isDuplicateReference(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export async function submitEnquiryAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = enquirySchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    category: formData.get("category"),
    subject: formData.get("subject"),
    message: formData.get("message"),
    eventDate: formData.get("eventDate"),
    estimatedQuantity: formData.get("estimatedQuantity"),
  });

  if (!parsed.success) {
    return fail(
      "Please check the highlighted fields.",
      fieldErrors(parsed.error),
    );
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const limit = rateLimit(`enquiry:${ip}`, LIMITS.enquiry(), 900);
  if (!limit.ok) {
    return fail(
      "We've already received a few enquiries from you. Please give us a few minutes, or call the studio if it's urgent.",
    );
  }

  const session = await getSession("site");
  const data = parsed.data;

  let reference = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    reference = await nextReference();

    try {
      await db.insert(enquiries).values({
        reference,
        userId: session?.user.id ?? null,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        category: data.category,
        subject: data.subject,
        message: data.message,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        estimatedQuantity: data.estimatedQuantity ?? null,
        status: "new",
      });
      break;
    } catch (error) {
      if (isDuplicateReference(error) && attempt < 2) continue;
      throw error;
    }
  }

  // Confirmation to the sender, notification to the studio.
  await Promise.all([
    sendMail(enquiryReceivedMail(data.email, data.name, reference)),
    sendMail(
      studioEnquiryMail(STUDIO.enquiriesInbox, {
        reference,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
      }),
    ),
  ]);

  // Signed-in customers see it in their account too.
  if (session) {
    await db.insert(notifications).values({
      userId: session.user.id,
      type: "quote_update",
      title: `We've received your enquiry (${reference})`,
      body: "We'll come back to you within one working day.",
      linkUrl: "/account/quotes",
    });
  }

  redirect(`/quote/thank-you?ref=${encodeURIComponent(reference)}`);
}
