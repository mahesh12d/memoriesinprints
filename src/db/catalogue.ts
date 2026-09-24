import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { productSizes, products } from "./schema";

/**
 * What the studio prints, as one list.
 *
 * It lives here rather than inside seed.ts because the seed deletes the whole
 * database before it runs: a working site cannot take a new product that way
 * without losing its portfolio, its orders and its users. Run this module on
 * its own (`npm run db:catalogue`) and it adds what is missing and leaves
 * everything else alone.
 *
 * Sizes carry their printed dimensions in the label, because that is how the
 * studio quotes them. A portrait offered in two sizes is listed as two sizes
 * rather than one line reading "or": one line is not a thing anyone can
 * order, and it was too long to read in the picker.
 */
export const CATALOGUE_PRODUCTS = [
      {
        slug: "order-of-service",
        name: "Order of service",
        category: "funeral",
        summary: "Booklets for the service, printed and folded by hand.",
        description:
          "An eight-page booklet printed on 170gsm silk paper, folded and saddle-stitched. Personalise with a photograph, the order of the service and a chosen verse or reading. A proof is sent for your approval before anything is printed.",
        minimumQuantity: 25,
        sortOrder: 1,
      },
      {
        slug: "memory-cards",
        name: "Memory cards",
        category: "funeral",
        summary: "A place to share precious memories.",
        description:
          "Memory cards give guests somewhere to leave a personal message, a treasured memory or a word of comfort for the family — a collection of stories to look back on in the days afterwards. They can also be sent ahead of the service to share the news and the details of the ceremony.",
        minimumQuantity: 25,
        sortOrder: 2,
      },
      {
        slug: "thank-you-card",
        name: "Thank you card",
        category: "funeral",
        summary: "A heartfelt way to say thank you.",
        description:
          "Sent after the service to thank those who came, sent flowers or simply stood by you. Usually ordered alongside the order of service so the two match.",
        minimumQuantity: 25,
        sortOrder: 3,
      },
      {
        slug: "attendance-cards",
        name: "Attendance cards",
        category: "funeral",
        summary: "A record of love and support.",
        description:
          "A simple way for the family to know who came. Guests sign their name or add a few words, leaving a lasting record of everyone who gathered. They can also be sent in advance as notice of the service.",
        minimumQuantity: 25,
        sortOrder: 4,
      },
      {
        slug: "memorial-boards",
        name: "Memorial boards",
        category: "funeral",
        summary: "A life told in photographs, displayed at the service.",
        description:
          "Printed on premium rigid foam board — light enough to stand free or sit on an easel, and durable enough to keep. Please allow an extra day in production for boards.",
        minimumQuantity: 1,
        sortOrder: 5,
      },
      {
        slug: "memory-boxes",
        name: "Memory boxes",
        category: "funeral",
        summary: "A beautiful place to store treasured keepsakes.",
        description:
          "A rigid box with a magnetic closure, made to hold the order of service, photographs, cards and mementos. Choose a standard design or have the lid personalised to match the stationery.",
        minimumQuantity: 1,
        sortOrder: 6,
      },
      {
        slug: "seed-cards",
        name: "Seed cards",
        category: "funeral",
        summary: "A living tribute.",
        description:
          "A laminated card with a seed packet attached to the reverse, removed without harming the card. Three flower varieties to choose from.",
        minimumQuantity: 25,
        sortOrder: 7,
      },
      {
        slug: "photo-prints",
        name: "Photo prints",
        category: "funeral",
        summary: "A cherished photograph, printed to fit the frame.",
        description:
          "Printed to fit a frame you already have for the service or the wake. The larger the print, the higher the resolution the original photograph needs to be.",
        minimumQuantity: 1,
        sortOrder: 8,
      },
      {
        slug: "bookmarks",
        name: "Bookmarks",
        category: "funeral",
        summary: "A keepsake for quiet moments.",
        description:
          "Small in size and big in meaning — a keepsake that turns up again every time a book is opened. Printed and laminated, with the name, the dates and a photograph or verse.",
        minimumQuantity: 25,
        sortOrder: 9,
      },
      {
        slug: "memorial-portraits",
        name: "Memorial portraits",
        category: "funeral",
        summary: "Portraits to treasure long after the day.",
        description:
          "Four styles, each chosen for the quality it holds at the price: the Classic, the Contemporary, the Reflection and the Traditional. Designed to look right during the ceremony and to stay up afterwards.",
        minimumQuantity: 1,
        sortOrder: 10,
      },
      {
        slug: "wedding-invitation-suite",
        name: "Wedding invitation suite",
        category: "wedding",
        summary: "Invitation, RSVP card and envelope, as one set.",
        description:
          "A complete suite: the invitation, a matching RSVP card and a lined envelope. Choose your stock and finish, and we'll proof the whole set together so the wording and colours match across every piece.",
        minimumQuantity: 50,
        sortOrder: 11,
      },
      {
        slug: "save-the-date",
        name: "Save the date",
        category: "wedding",
        summary: "Sent early, so the right people hold the day.",
        description:
          "A single card, usually posted six to twelve months ahead. Often the first piece we design, and the one that sets the look of everything that follows.",
        minimumQuantity: 50,
        sortOrder: 12,
      },
      {
        slug: "order-of-the-day",
        name: "Order of the day",
        category: "wedding",
        summary: "The running order, for the ceremony or the reception.",
        description:
          "A card or folded booklet setting out the timings, readings and the people involved. Designed to sit on a seat or a table without shouting.",
        minimumQuantity: 50,
        sortOrder: 13,
      },
      {
        slug: "christening-invitation",
        name: "Christening invitation",
        category: "celebration",
        summary: "Simple, warm invitations for a christening or naming day.",
        description:
          "A single card with a matching envelope, kept gentle and uncluttered. Photographs work well here if you have one you like.",
        minimumQuantity: 25,
        sortOrder: 14,
      },
      {
        slug: "anniversary-keepsake-print",
        name: "Anniversary keepsake print",
        category: "celebration",
        summary: "A framed print marking a date worth keeping.",
        description:
          "A single print on heavyweight stock, designed around a date, a place or a few words. Supplied unframed unless you ask otherwise.",
        minimumQuantity: 1,
        sortOrder: 15,
      },
] satisfies (typeof products.$inferInsert)[];

/** The sizes each product is offered in, given the ids it was inserted with. */
export function catalogueSizes(bySlug: Record<string, string>) {
  return [
    { productId: bySlug["order-of-service"], label: "A5 booklet", widthMm: 148, heightMm: 210, sortOrder: 1 },
    { productId: bySlug["order-of-service"], label: "A4 booklet", widthMm: 210, heightMm: 297, sortOrder: 2 },
    /*
      The dimensions sit in the label, not only in the two columns beside it.

      A memory box is 300 × 310 × 70mm and a Contemporary portrait comes in
      either of two sizes — neither fits a width and a height, and the studio
      quotes all of these by their printed dimensions. The columns are still
      filled wherever the size really is a flat rectangle, so anything that
      needs to lay out a sheet can read them.
    */
    { productId: bySlug["memory-cards"], label: "Standard — A6 (148 × 105mm)", widthMm: 148, heightMm: 105, sortOrder: 1 },
    { productId: bySlug["thank-you-card"], label: "Standard — A6 (105 × 148mm)", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["attendance-cards"], label: "Standard — 148 × 105mm", widthMm: 148, heightMm: 105, sortOrder: 1 },
    { productId: bySlug["memorial-boards"], label: "A1 — 594 × 841mm", widthMm: 594, heightMm: 841, sortOrder: 1 },
    { productId: bySlug["memorial-boards"], label: "A2 — 420 × 594mm", widthMm: 420, heightMm: 594, sortOrder: 2 },
    { productId: bySlug["memorial-boards"], label: "A3 — 297 × 420mm", widthMm: 297, heightMm: 420, sortOrder: 3 },
    { productId: bySlug["memory-boxes"], label: "Large — 300 × 310 × 70mm", widthMm: 300, heightMm: 310, sortOrder: 1 },
    { productId: bySlug["memory-boxes"], label: "Medium — 245 × 300 × 70mm", widthMm: 245, heightMm: 300, sortOrder: 2 },
    { productId: bySlug["memory-boxes"], label: "Small — 219 × 223 × 70mm", widthMm: 219, heightMm: 223, sortOrder: 3 },
    { productId: bySlug["seed-cards"], label: "Standard — 82 × 112mm", widthMm: 82, heightMm: 112, sortOrder: 1 },
    { productId: bySlug["photo-prints"], label: "A4 — 210 × 297mm", widthMm: 210, heightMm: 297, sortOrder: 1 },
    { productId: bySlug["photo-prints"], label: "A5 — 148 × 210mm", widthMm: 148, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["photo-prints"], label: "10 × 8in — 254 × 203mm", widthMm: 254, heightMm: 203, sortOrder: 3 },
    { productId: bySlug["bookmarks"], label: "Standard — 50 × 200mm", widthMm: 50, heightMm: 200, sortOrder: 1 },
    { productId: bySlug["memorial-portraits"], label: "The Classic — 229 × 305mm", widthMm: 229, heightMm: 305, sortOrder: 1 },
    { productId: bySlug["memorial-portraits"], label: "The Contemporary — 305 × 305 × 38mm", widthMm: 305, heightMm: 305, sortOrder: 2 },
    { productId: bySlug["memorial-portraits"], label: "The Contemporary — 305 × 406 × 38mm", widthMm: 305, heightMm: 406, sortOrder: 3 },
    { productId: bySlug["memorial-portraits"], label: "The Reflection — 279 × 103 × 19mm", widthMm: 279, heightMm: 103, sortOrder: 4 },
    { productId: bySlug["memorial-portraits"], label: "The Reflection — 152 × 203 × 19mm", widthMm: 152, heightMm: 203, sortOrder: 5 },
    { productId: bySlug["memorial-portraits"], label: "The Traditional — 458 × 599mm", widthMm: 458, heightMm: 599, sortOrder: 6 },
    { productId: bySlug["wedding-invitation-suite"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["wedding-invitation-suite"], label: "A5", widthMm: 148, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["wedding-invitation-suite"], label: "Square 148mm", widthMm: 148, heightMm: 148, sortOrder: 3 },
    { productId: bySlug["save-the-date"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["save-the-date"], label: "DL", widthMm: 99, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["order-of-the-day"], label: "DL", widthMm: 99, heightMm: 210, sortOrder: 1 },
    { productId: bySlug["christening-invitation"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["anniversary-keepsake-print"], label: "A4", widthMm: 210, heightMm: 297, sortOrder: 1 },
  ];
}

/**
 * Adds anything missing, changes nothing that is already there.
 *
 * Product copy is refreshed for products that exist, because that is text the
 * studio edits. Sizes are only ever added: deleting one cascades to its
 * prices, which is not a thing an import should do quietly.
 */
export async function upsertCatalogue() {
  const keep = (column: string) => sql.raw(`excluded.${column}`);

  const inserted = await db
    .insert(products)
    .values(CATALOGUE_PRODUCTS)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        name: keep("name"),
        category: keep("category"),
        summary: keep("summary"),
        description: keep("description"),
        minimumQuantity: keep("minimum_quantity"),
        sortOrder: keep("sort_order"),
        isActive: keep("is_active"),
        updatedAt: new Date(),
      },
    })
    .returning({ id: products.id, slug: products.slug });

  const bySlug = Object.fromEntries(inserted.map((row) => [row.slug, row.id]));

  const existing = await db
    .select({ productId: productSizes.productId, label: productSizes.label })
    .from(productSizes);
  const have = new Set(existing.map((row) => `${row.productId}::${row.label}`));

  const missing = catalogueSizes(bySlug).filter(
    (size) => !have.has(`${size.productId}::${size.label}`),
  );
  if (missing.length > 0) await db.insert(productSizes).values(missing);

  return { products: inserted.length, sizesAdded: missing.length };
}

// Run directly: npm run db:catalogue
if (process.argv[1]?.replaceAll("\\", "/").endsWith("src/db/catalogue.ts")) {
  upsertCatalogue().then((result) => {
    console.log(`${result.products} products, ${result.sizesAdded} sizes added`);
    process.exit(0);
  });
}
