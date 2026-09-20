/**
 * Studio details used across the public site.
 *
 * The bracketed values are placeholders carried over from the approved design —
 * replace them with the real details before launch. They're gathered here so
 * that's one edit rather than a hunt through the pages.
 */
export const STUDIO = {
  city: "[Studio City]",
  email: "[studio email]",
  phone: "[studio phone]",
  openingHours: "Mon–Fri, [X]am–[X]pm",
  founderName: "[Founder Name]",
  foundedYear: "[Year]",
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  pinterest: "https://pinterest.com/",
  /** Where quote notifications are sent. Falls back to the from address. */
  enquiriesInbox:
    process.env.STUDIO_ENQUIRIES_EMAIL ?? "studio@memoriesinprints.co.uk",
} as const;

export const TURNAROUND_NOTE =
  "Standard turnaround is 3–5 working days from proof approval, with a rush service available for urgent dates.";
