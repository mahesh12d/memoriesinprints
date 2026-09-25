import "dotenv/config";

import { and, asc, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "./index";
import { portfolioItems } from "./schema";

/**
 * Files every design into its collection, from its catalogue number.
 *
 *   npx tsx src/db/collections.ts [--dry]
 *
 * The studio numbers its templates in blocks, one block per collection, so
 * the number already says which collection a piece belongs to — `style` is
 * just that answer written down where the filter chips can read it. Run it
 * again after adding designs and the new ones fall into place.
 */
export const COLLECTIONS: { name: string; from: number; to: number }[] = [
  { name: "Children", from: 1, to: 16 },
  { name: "Simple", from: 101, to: 112 },
  { name: "Floral", from: 113, to: 136 },
  { name: "Hobby", from: 137, to: 154 },
  { name: "Countryside", from: 155, to: 166 },
  { name: "Religious", from: 167, to: 184 },
  { name: "Asian", from: 185, to: 190 },
];

export function collectionFor(templateNumber: number): string | null {
  return (
    COLLECTIONS.find(
      (one) => templateNumber >= one.from && templateNumber <= one.to,
    )?.name ?? null
  );
}

async function run() {
  const dryRun = process.argv.includes("--dry");

  for (const { name, from, to } of COLLECTIONS) {
    const result = await db
      .update(portfolioItems)
      .set({ style: name, updatedAt: new Date() })
      .where(
        and(
          gte(portfolioItems.templateNumber, from),
          lte(portfolioItems.templateNumber, to),
        ),
      )
      .returning({ slug: portfolioItems.slug });

    console.log(`${name.padEnd(12)} ${from}-${to}: ${result.length}`);
    if (dryRun) throw new Error("dry run — roll back");
  }

  // Numbered pieces no block covers. Left as they are rather than guessed at.
  const all = await db
    .select({
      n: portfolioItems.templateNumber,
      title: portfolioItems.title,
      style: portfolioItems.style,
      published: portfolioItems.isPublished,
    })
    .from(portfolioItems)
    .where(isNotNull(portfolioItems.templateNumber))
    .orderBy(asc(portfolioItems.templateNumber));

  const loose = all.filter((row) => collectionFor(row.n!) === null);
  if (loose.length > 0) {
    console.log(`\nno collection covers these ${loose.length}:`);
    for (const row of loose) {
      console.log(
        `  #${row.n}  ${row.title}  (style: ${row.style ?? "none"}${row.published ? "" : ", unpublished"})`,
      );
    }
  }
}

void run().then(() => process.exit(0));
