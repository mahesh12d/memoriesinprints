import type { productCategory } from "@/db/schema";

export type Category = (typeof productCategory.enumValues)[number];

/*
  The studio only takes funeral work today. Every category tab, nav dropdown
  and quote-form option is built from this list, so shortening it hides the
  others everywhere at once — and `isCategory` stops honouring
  ?category=wedding typed into the address bar.

  The labels and blurbs below keep all three: nothing breaks if a stray row
  still carries one, and putting a category back is adding it here.
*/
export const CATEGORIES: Category[] = ["funeral"];

export const CATEGORY_LABEL: Record<Category, string> = {
  funeral: "Funeral",
  wedding: "Wedding",
  celebration: "Celebration",
};

export const CATEGORY_BLURB: Record<Category, string> = {
  funeral:
    "A considered range of keepsakes and stationery for funerals, memorials and services of remembrance — each piece proofed with you before it's printed.",
  wedding:
    "Invitations, save the dates and on-the-day stationery, designed around your colours and printed to the date you're working towards.",
  celebration:
    "Christenings, naming days, anniversaries and everything in between — the same care, for the happier occasions.",
};

export function isCategory(value: string | undefined): value is Category {
  return value !== undefined && CATEGORIES.includes(value as Category);
}

/** Pence to "£12.50", the way the site shows money everywhere. */
export function formatPrice(pence: number | null | undefined): string {
  if (pence === null || pence === undefined) return "Price on request";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);
}
