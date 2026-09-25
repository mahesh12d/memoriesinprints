import "dotenv/config";

import { readFileSync } from "node:fs";
import { eq, ne, and } from "drizzle-orm";
import { db } from "./index";
import { portfolioItems } from "./schema";
import { slugify } from "@/lib/admin/labels";

/**
 * Brings the portfolio across from the old application's export.
 *
 *   npx tsx src/db/import-portfolio.ts portfolio_items.csv [--webp] [--dry]
 *
 * Rows keep the ids they had, so running it twice updates the same pieces
 * rather than making a second copy of the catalogue — and a correction in the
 * old system can be re-exported over the top.
 *
 * Nothing is deleted. A piece that exists here and not in the file is left
 * exactly where it is.
 */

const OLD_PREFIX = "https://pub-172d7d176e1b4109938fad7b98c20ca7.r2.dev/";
const NEW_PREFIX = "https://pub-5489cec7004f4556954b4bb0c4de41a9.r2.dev/portfolio/";

const CATEGORIES = ["funeral", "wedding", "celebration"] as const;
type Category = (typeof CATEGORIES)[number];

/**
 * A CSV reader that copes with what this file actually contains: quoted
 * fields holding commas, newlines and doubled quotes — the JSON in `filters`
 * has all three.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((one) => one.some((cell) => cell !== ""));

  return body.map((cells) =>
    Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])),
  );
}

async function run() {
  const args = process.argv.slice(2);
  const file = args.find((one) => !one.startsWith("--")) ?? "portfolio_items.csv";
  const toWebp = args.includes("--webp");
  const dryRun = args.includes("--dry");

  // Excel writes a byte-order mark, which would otherwise become part of the
  // first column's name and hide the `id` field.
  const rows = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  console.log(`${rows.length} rows in ${file}`);

  let written = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    const category = row.category as Category;
    if (!CATEGORIES.includes(category)) {
      skipped.push(`${row.title}: unknown category "${row.category}"`);
      continue;
    }

    /*
      The bucket moves and the folder gains a level; the rest of the path is the
      filename the old system escaped, which is left exactly as it was so the
      object in the new bucket can carry the same name.
    */
    let imageUrl = row.image_url.startsWith(OLD_PREFIX)
      ? NEW_PREFIX + row.image_url.slice(OLD_PREFIX.length)
      : row.image_url;

    if (toWebp) imageUrl = imageUrl.replace(/\.jpe?g$/i, ".webp");

    let filters: Record<string, string[]> = {};
    try {
      filters = JSON.parse(row.filters || "{}");
    } catch {
      skipped.push(`${row.title}: filters could not be read`);
      continue;
    }

    const templateNumber = row.template_number.trim()
      ? Number(row.template_number)
      : null;

    /*
      Template numbers are unique across the whole portfolio. One already used
      by a different piece is reported rather than overwritten — that is the
      studio's own catalogue number, and guessing which of the two is right is
      not this script's job.
    */
    if (templateNumber !== null) {
      const clash = await db
        .select({ slug: portfolioItems.slug })
        .from(portfolioItems)
        .where(
          and(
            eq(portfolioItems.templateNumber, templateNumber),
            ne(portfolioItems.id, row.id),
          ),
        )
        .limit(1);

      if (clash.length > 0) {
        skipped.push(
          `${row.title}: template no. ${templateNumber} is already on "${clash[0].slug}"`,
        );
        continue;
      }
    }

    const values = {
      id: row.id,
      slug: slugify(row.title),
      title: row.title,
      category,
      description: row.description || null,
      imageUrl,
      templateNumber,
      // The chips on /portfolio read this one; the rest are kept in filters.
      style: filters.style?.[0] ?? null,
      filters,
      isPublished: row.published !== "false",
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    };

    if (dryRun) {
      written++;
      continue;
    }

    await db
      .insert(portfolioItems)
      .values(values)
      .onConflictDoUpdate({
        target: portfolioItems.id,
        set: {
          slug: values.slug,
          title: values.title,
          category: values.category,
          description: values.description,
          imageUrl: values.imageUrl,
          templateNumber: values.templateNumber,
          style: values.style,
          filters: values.filters,
          isPublished: values.isPublished,
          updatedAt: new Date(),
        },
      });

    written++;
  }

  console.log(
    `${dryRun ? "would write" : "written"}: ${written}` +
      (toWebp ? " (image urls rewritten to .webp)" : ""),
  );

  if (skipped.length > 0) {
    console.log(`\nskipped ${skipped.length}:`);
    for (const line of skipped) console.log(`  ${line}`);
  }

}

void run().then(() => process.exit(0));

