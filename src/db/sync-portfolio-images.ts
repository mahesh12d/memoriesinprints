import "dotenv/config";

import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { portfolioItems } from "./schema";

/**
 * Points every portfolio piece at the object that is actually in the bucket.
 *
 *   npx tsx src/db/sync-portfolio-images.ts [--dry]
 *
 * The catalogue was exported from a bucket laid out one way and uploaded to
 * one laid out another: the old paths carried a category folder and a .jpg,
 * the new objects sit flat under portfolio/ and have been converted to .webp.
 * Rather than encode that particular difference, this matches on the filename
 * — which is the part that identifies the piece — and rewrites the URL to
 * whatever key is really there, whatever folder and format that turns out to
 * be.
 *
 * Anything it cannot match is reported and left alone. A row pointing at a
 * missing image is a piece with no photograph; a row pointing at the wrong
 * image is a piece showing somebody else's.
 */

const PUBLIC = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");

/** The part of a key that names the piece: no folder, no extension, no case. */
function nameOf(key: string): string {
  return key.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
}

/** A URL the browser can use, with each segment escaped as R2 expects. */
function publicUrl(key: string): string {
  return `${PUBLIC}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function listBucket(): Promise<string[]> {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });

  const keys: string[] = [];
  let token: string | undefined;

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET ?? "",
        Prefix: "portfolio/",
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );

    for (const object of page.Contents ?? []) {
      if (object.Key) keys.push(object.Key);
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return keys;
}

async function run() {
  if (!PUBLIC) throw new Error("R2_PUBLIC_URL is not set.");

  const dryRun = process.argv.includes("--dry");
  const keys = await listBucket();

  /*
    Two objects with the same filename in different folders cannot be told
    apart by name, so neither is used for a match. Guessing which of them a
    piece meant is how the wrong face ends up on an order of service.
  */
  const byName = new Map<string, string[]>();
  for (const key of keys) {
    const name = nameOf(key);
    byName.set(name, [...(byName.get(name) ?? []), key]);
  }

  const rows = await db
    .select({
      id: portfolioItems.id,
      slug: portfolioItems.slug,
      imageUrl: portfolioItems.imageUrl,
    })
    .from(portfolioItems);

  let changed = 0;
  let already = 0;
  const unmatched: string[] = [];
  const ambiguous: string[] = [];

  for (const row of rows) {
    // Only rows pointing at this bucket. An uploaded image stored as a
    // `stored:` key, or a URL somewhere else entirely, is not ours to move.
    if (!row.imageUrl?.startsWith(PUBLIC)) continue;

    const current = decodeURIComponent(row.imageUrl.slice(PUBLIC.length + 1));
    const matches = byName.get(nameOf(current)) ?? [];

    if (matches.length === 0) {
      unmatched.push(`${row.slug}  →  ${current}`);
      continue;
    }

    if (matches.length > 1) {
      ambiguous.push(`${row.slug}  →  ${matches.join(", ")}`);
      continue;
    }

    if (matches[0] === current) {
      already++;
      continue;
    }

    if (!dryRun) {
      await db
        .update(portfolioItems)
        .set({ imageUrl: publicUrl(matches[0]), updatedAt: new Date() })
        .where(eq(portfolioItems.id, row.id));
    }

    changed++;
  }

  console.log(`${keys.length} objects in the bucket, ${rows.length} pieces on file`);
  console.log(`${dryRun ? "would repoint" : "repointed"}: ${changed}`);
  console.log(`already correct: ${already}`);

  if (ambiguous.length > 0) {
    console.log(`\nsame name in two places, left alone (${ambiguous.length}):`);
    for (const line of ambiguous) console.log(`  ${line}`);
  }

  if (unmatched.length > 0) {
    console.log(`\nno object in the bucket (${unmatched.length}):`);
    for (const line of unmatched) console.log(`  ${line}`);
  }

  const claimed = new Set(
    rows
      .filter((row) => row.imageUrl?.startsWith(PUBLIC))
      .map((row) => nameOf(decodeURIComponent(row.imageUrl!.slice(PUBLIC.length + 1)))),
  );
  const spare = keys.filter((key) => !claimed.has(nameOf(key)));

  if (spare.length > 0) {
    console.log(`\nobjects no piece points at (${spare.length}):`);
    for (const key of spare) console.log(`  ${key}`);
  }
}

void run().then(() => process.exit(0));
