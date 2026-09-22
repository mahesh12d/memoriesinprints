import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
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
  return loadSavedIds("product");
}

/** The same, for portfolio designs saved from the portfolio pages. */
export async function loadSavedTemplateIds(): Promise<Set<string>> {
  return loadSavedIds("template");
}

async function loadSavedIds(kind: "product" | "template"): Promise<Set<string>> {
  const session = await getSession("site");
  if (!session) return new Set();

  const column =
    kind === "product" ? savedItems.productId : savedItems.portfolioItemId;

  const rows = await db
    .select({ id: column })
    .from(savedItems)
    .where(and(eq(savedItems.userId, session.user.id), isNotNull(column)));

  // The column is nullable on the table but never null in these rows, which
  // the filter above guarantees and the check constraint backs up.
  return new Set(rows.flatMap((row) => (row.id ? [row.id] : [])));
}
