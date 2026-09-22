"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { savedItems } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

/**
 * Saving needs an account, because a saved list has to belong to somebody.
 *
 * Rather than refusing, a signed-out visitor is sent to sign in and brought
 * straight back to the product they were looking at, so the click isn't lost.
 */
export async function toggleSavedItemAction(formData: FormData): Promise<void> {
  const productId = String(formData.get("productId") ?? "");
  const templateId = String(formData.get("portfolioItemId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/products");

  const isTemplate = templateId !== "";
  const targetId = isTemplate ? templateId : productId;

  if (!z.string().uuid().safeParse(targetId).success) return;

  const session = await getSession("site");

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  // Exactly one of the two columns carries the id; the other stays null, which
  // is what the table's check constraint requires.
  const column = isTemplate ? savedItems.portfolioItemId : savedItems.productId;

  const where = and(eq(savedItems.userId, session.user.id), eq(column, targetId));

  const [existing] = await db
    .select({ id: savedItems.id })
    .from(savedItems)
    .where(where)
    .limit(1);

  if (existing) {
    await db.delete(savedItems).where(eq(savedItems.id, existing.id));
  } else {
    // Two quick clicks would otherwise race into a duplicate; the unique index
    // on (user, product) is what actually guarantees it, and this makes the
    // second insert a no-op rather than an error page.
    await db
      .insert(savedItems)
      .values({
        userId: session.user.id,
        productId: isTemplate ? null : targetId,
        portfolioItemId: isTemplate ? targetId : null,
      })
      .onConflictDoNothing();
  }

  revalidatePath("/account/saved");
  revalidatePath(returnTo);
}
