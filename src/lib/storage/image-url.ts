import { signedReadUrl } from "./storage";

/**
 * Catalogue images are stored as an object key, never as a URL.
 *
 * A signed URL expires, so writing one into the database would give you a
 * product photo that worked for ten minutes and then didn't. The key is
 * stored instead and signed freshly whenever a page renders.
 *
 * The prefix marks a value as ours; anything else — an absolute URL typed in
 * by hand, or a path under /images — is handed back untouched.
 */
const PREFIX = "stored:";

export function markStored(storageKey: string): string {
  return `${PREFIX}${storageKey}`;
}

export function isStored(value: string | null): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export async function resolveImageUrl(
  value: string | null,
): Promise<string | null> {
  if (!value) return null;
  if (!isStored(value)) return value;

  return signedReadUrl(value.slice(PREFIX.length));
}

/** Resolves a whole list in one pass, keeping the order. */
export async function resolveImageUrls(
  values: (string | null)[],
): Promise<(string | null)[]> {
  return Promise.all(values.map(resolveImageUrl));
}
