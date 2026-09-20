/**
 * One place where a database enum becomes something a person reads.
 *
 * These were scattered across five screens, each with its own wording, so a
 * customer could be told "Proof on its way" while the studio saw
 * "awaiting_proof". Everything reads from here now.
 */

export type Tone = "good" | "pending" | "alert" | "neutral";
export type Label = { label: string; tone: Tone };

export const ENQUIRY_STATUS = {
  new: { label: "New", tone: "pending" },
  reviewed: { label: "Reviewed", tone: "neutral" },
  quoted: { label: "Quoted", tone: "neutral" },
  converted: { label: "Became an order", tone: "good" },
  declined: { label: "Declined", tone: "alert" },
  cancelled: { label: "Cancelled", tone: "alert" },
} satisfies Record<string, Label>;

export const ORDER_STATUS = {
  awaiting_price: { label: "Awaiting price", tone: "pending" },
  awaiting_payment: { label: "Awaiting payment", tone: "pending" },
  awaiting_proof: { label: "Proof on its way", tone: "pending" },
  in_production: { label: "In production", tone: "neutral" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "alert" },
} satisfies Record<string, Label>;

export const PAYMENT_STATUS = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  paid: { label: "Paid", tone: "good" },
  refunded: { label: "Refunded", tone: "alert" },
} satisfies Record<string, Label>;

export const PROOF_STATUS = {
  awaiting_proofreading: { label: "Needs proofreading", tone: "pending" },
  returned_to_designer: { label: "Returned to designer", tone: "alert" },
  awaiting_customer: { label: "With the customer", tone: "neutral" },
  approved: { label: "Approved", tone: "good" },
  changes_requested: { label: "Changes requested", tone: "alert" },
} satisfies Record<string, Label>;

export const CATEGORY: Record<string, string> = {
  funeral: "Funeral",
  wedding: "Wedding",
  celebration: "Celebration",
};

export const ROLE: Record<string, string> = {
  customer: "Customer",
  designer: "Designer",
  proofreader: "Proofreader",
  admin: "Administrator",
};

/** Falls back to the raw value rather than showing a blank cell. */
export function describe(map: Record<string, Label>, value: string): Label {
  return map[value] ?? { label: value, tone: "neutral" };
}

/**
 * Turns a title into a URL slug.
 *
 * Used when the studio adds a product or a portfolio piece without typing one
 * themselves. Accented letters are folded rather than dropped, so "Bébé" gives
 * "bebe" and not "bb".
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Makes a slug unique against the ones already taken, by adding -2, -3 and so
 * on. The base slug is returned untouched when it is free.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }

  throw new Error(`Could not find a free slug for "${base}"`);
}
