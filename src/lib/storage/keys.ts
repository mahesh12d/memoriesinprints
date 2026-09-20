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
