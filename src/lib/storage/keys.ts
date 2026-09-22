import { randomBytes } from "node:crypto";
import path from "node:path";

/**
 * Key naming, kept out of storage.ts because that module is `server-only`
 * and the seed script needs these too.
 */

/** Where the development fallback writes, when R2 isn't configured. */
export const LOCAL_UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** Keys are prefixed and randomised so one can't be guessed from another. */
export function buildStorageKey(prefix: string, fileName: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);

  return `${prefix}/${Date.now().toString(36)}-${randomBytes(8).toString("hex")}-${safeName}`;
}

/** Where a completed order's final artwork is kept, separate from working files. */
export const ARCHIVE_PREFIX = "archive";

/**
 * The archive key for a finished proof.
 *
 * Grouped by order reference and stamped with the version, so the bucket
 * reads as a filing cabinet rather than a pile: archive/MIP-1042/v3-....pdf
 */
export function buildArchiveKey(
  reference: string,
  versionNumber: number,
  fileName: string | null,
): string {
  const safeReference = reference.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return buildStorageKey(
    `${ARCHIVE_PREFIX}/${safeReference}`,
    `v${versionNumber}-${fileName ?? "proof"}`,
  );
}

/**
 * Resolves a key under the local upload directory.
 *
 * Keys are generated above and never come from user input, but a traversal
 * guard costs nothing and keeps that true if that ever changes.
 */
export function localUploadPath(storageKey: string): string {
  const resolved = path.resolve(LOCAL_UPLOAD_DIR, storageKey);
  if (!resolved.startsWith(path.resolve(LOCAL_UPLOAD_DIR))) {
    throw new Error("Refusing a storage key that escapes the upload directory");
  }
  return resolved;
}
