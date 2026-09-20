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
  const returnTo = String(formData.get("returnTo") ?? "/products");

  if (!z.string().uuid().safeParse(productId).success) return;

  const session = await getSession("site");

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  }

  const where = and(
    eq(savedItems.userId, session.user.id),
    eq(savedItems.productId, productId),
  );

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
      .values({ userId: session.user.id, productId })
      .onConflictDoNothing();
  }

  revalidatePath("/account/saved");
  revalidatePath(returnTo);
}
