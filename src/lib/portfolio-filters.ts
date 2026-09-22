import "server-only";

import { and, count, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import type { Category } from "@/lib/catalogue";

export type FilterOption = { value: string; count: number };

/**
 * What the portfolio can be filtered by, read from the pieces themselves.
 *
 * The chips are whatever styles are actually in use, so adding a piece marked
 * "Nautical" puts a Nautical chip on the page with no code change. Everything
 * is scoped to the category being viewed, so a chip that would return nothing
 * is never offered.
 */
export async function loadStyles(
  category: Category | undefined,
): Promise<FilterOption[]> {
  const rows = await db
    .select({ value: portfolioItems.style, count: count() })
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.isPublished, true),
        isNotNull(portfolioItems.style),
        category ? eq(portfolioItems.category, category) : undefined,
      ),
    )
    .groupBy(portfolioItems.style)
    .orderBy(portfolioItems.style);

  return rows.map((row) => ({ value: row.value ?? "", count: row.count }));
}

/**
 * The template numbers on offer within the category being viewed.
 *
 * Numbers are unique per piece, so each count is all but always 1. It is
 * shown anyway because an unpublished duplicate would make it something else,
 * and a column that quietly lies is worse than one stating the obvious.
 */
export async function loadTemplateNumbers(
  category: Category | undefined,
): Promise<{ number: number; count: number }[]> {
  const rows = await db
    .select({ number: portfolioItems.templateNumber, count: count() })
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.isPublished, true),
        isNotNull(portfolioItems.templateNumber),
        category ? eq(portfolioItems.category, category) : undefined,
      ),
    )
    .groupBy(portfolioItems.templateNumber)
    .orderBy(sql`${portfolioItems.templateNumber} desc`);

  return rows.map((row) => ({ number: row.number ?? 0, count: row.count }));
}

/** How many of the category's pieces the studio has pinned as popular. */
export async function countPopular(
  category: Category | undefined,
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.isPublished, true),
        eq(portfolioItems.isPopular, true),
        category ? eq(portfolioItems.category, category) : undefined,
      ),
    );

  return row?.count ?? 0;
}
