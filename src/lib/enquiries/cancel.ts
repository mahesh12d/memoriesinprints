"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";

/**
 * A customer can withdraw their own enquiry, but only while it's still open —
 * and the ownership check is in the WHERE clause, so a forged id belonging to
 * someone else simply matches nothing.
 */
export async function cancelEnquiryAction(formData: FormData): Promise<void> {
  const session = await requireUser();

  const enquiryId = formData.get("enquiryId");
  if (typeof enquiryId !== "string" || !enquiryId) return;

  await db
    .update(enquiries)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(enquiries.id, enquiryId),
        eq(enquiries.userId, session.user.id),
        inArray(enquiries.status, ["new", "reviewed", "quoted"]),
      ),
    );

  revalidatePath("/account/order-forms");
}
