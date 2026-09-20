/**
 * Cart and order lines are identified by a single string, so one column can
 * hold either kind of thing we sell.
 *
 *   "order-of-service::A5 booklet::3"   a catalogue product
 *   "7f3c…-uuid"                        a portfolio piece
 *
 * The rule is the separator: anything containing "::" goes down the catalogue
 * path, anything else is treated as a portfolio-item id. Both paths are real
 * and neither is a fallback for the other.
 */

export const KEY_SEPARATOR = "::";

export type ParsedKey =
  | {
      kind: "product";
      slug: string;
      size: string;
      templateNumber: number;
      raw: string;
    }
  | { kind: "portfolio"; portfolioItemId: string; raw: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildProductKey(
  slug: string,
  size: string,
  templateNumber: number | string = 1,
): string {
  return [slug, size, templateNumber].join(KEY_SEPARATOR);
}

/** Returns null for anything malformed — callers must handle that. */
export function parseItemKey(raw: string): ParsedKey | null {
  const value = raw?.trim();
  if (!value) return null;

  if (value.includes(KEY_SEPARATOR)) {
    const parts = value.split(KEY_SEPARATOR);
    if (parts.length !== 3) return null;

    const [slug, size, template] = parts.map((part) => part.trim());
    if (!slug || !size) return null;

    // A template number is expected, but a missing or unparseable one falls
    // back to the first template rather than rejecting the whole line.
    const templateNumber = Number.parseInt(template, 10);

    return {
      kind: "product",
      slug,
      size,
      templateNumber:
        Number.isFinite(templateNumber) && templateNumber > 0
          ? templateNumber
          : 1,
      raw: value,
    };
  }

  if (!UUID.test(value)) return null;

  return { kind: "portfolio", portfolioItemId: value.toLowerCase(), raw: value };
}

export function isProductKey(raw: string): boolean {
  return parseItemKey(raw)?.kind === "product";
}
