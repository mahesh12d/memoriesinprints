/**
 * Studio details used across the public site.
 *
 * The bracketed values are placeholders carried over from the approved design —
 * replace them with the real details before launch. They're gathered here so
 * that's one edit rather than a hunt through the pages.
 */
export const STUDIO = {
  city: "[Studio City]",
  email: "info@memoriesinprints.com",
  phone: "[studio phone]",
  openingHours: "Mon–Fri, 08:30 am– 05:30 pm",
  founderName: "[Founder Name]",
  foundedYear: "[Year]",
  /** The domain shown in the footer. Confirm before launch. */
  domain: "www.memoriesinprints.com",
  /** The company behind the brand, for the copyright line. */
  legalEntity: "Viora Memories In Prints Pvt Ltd",
  instagram: "https://www.instagram.com/memoriesin.prints/",
  facebook:
    "https://www.facebook.com/profile.php?id=61584548137585&sk=photos",
  /*
    The public company page. The URL supplied was the admin dashboard
    (/company/122754103/admin/dashboard/), which only signed-in page admins
    can open — a visitor clicking it would land on a LinkedIn error.
  */
  linkedin: "https://www.linkedin.com/company/122754103/",
  /** Where quote notifications are sent. Falls back to the from address. */
  enquiriesInbox:
    process.env.STUDIO_ENQUIRIES_EMAIL ?? "studio@memoriesinprints.co.uk",
} as const;

export const TURNAROUND_NOTE =
  "Standard turnaround is 3–5 working days from proof approval, with a rush service available for urgent dates.";
