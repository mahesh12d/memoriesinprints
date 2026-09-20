import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savedItems } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

/**
 * Which products the person looking at the page has saved.
 *
 * One query for the whole list rather than one per card, and an empty set for
 * a signed-out visitor — the button still renders for them, and clicking it
 * sends them to sign in and back again.
 */
export async function loadSavedProductIds(): Promise<Set<string>> {
  const session = await getSession("site");
  if (!session) return new Set();

  const rows = await db
    .select({ productId: savedItems.productId })
    .from(savedItems)
    .where(eq(savedItems.userId, session.user.id));

  return new Set(rows.map((row) => row.productId));
}
