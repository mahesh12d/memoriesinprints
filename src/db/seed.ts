import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { db } from "./index";
import {
  activityEvents,
  enquiries,
  notifications,
  orderItems,
  orders,
  payments,
  portfolioItems,
  pricingAddons,
  pricingBase,
  pricingTurnaround,
  pricingVolumeTiers,
  productSizes,
  products,
  proofComments,
  proofVersions,
  savedItems,
  sessions,
  users,
  verificationTokens,
} from "./schema";

/**
 * Development seed. It clears everything first, so it can be re-run freely
 * while we're building.
 *
 * Never point this at a production database — it deletes the users table.
 */
const DEMO_PASSWORD = "printsdemo2026";

async function reset() {
  // Children before parents; foreign keys are enforced.
  await db.delete(proofComments);
  await db.delete(proofVersions);
  await db.delete(payments);
  await db.delete(orderItems);
  await db.delete(activityEvents);
  await db.delete(orders);
  await db.delete(enquiries);
  await db.delete(savedItems);
  await db.delete(notifications);
  await db.delete(pricingBase);
  await db.delete(pricingVolumeTiers);
  await db.delete(pricingAddons);
  await db.delete(pricingTurnaround);
  await db.delete(productSizes);
  await db.delete(products);
  await db.delete(portfolioItems);
  await db.delete(sessions);
  await db.delete(verificationTokens);
  await db.delete(users);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV is production.");
  }

  console.log("Clearing existing data…");
  await reset();

  console.log("Seeding…");

  const passwordHash = await hash(DEMO_PASSWORD, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const now = new Date();

  const [customer, designer, proofreader, admin] = await db
    .insert(users)
    .values([
      {
        name: "Jordan Ellis",
        email: "customer@example.com",
        passwordHash,
        role: "customer",
        emailVerifiedAt: now,
        phone: "07700 900123",
        addressLine1: "12 Chapel Row",
        city: "Bristol",
        postcode: "BS1 4XX",
        country: "United Kingdom",
      },
      {
        name: "Sam Carter",
        email: "designer@example.com",
        passwordHash,
        role: "designer",
        emailVerifiedAt: now,
      },
      {
        name: "Riley Moore",
        email: "proofreader@example.com",
        passwordHash,
        role: "proofreader",
        emailVerifiedAt: now,
      },
      {
        name: "Jane Baker",
        email: "admin@example.com",
        passwordHash,
        role: "admin",
        emailVerifiedAt: now,
      },
    ])
    .returning({ id: users.id, email: users.email });

  const insertedProducts = await db
    .insert(products)
    .values([
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
        slug: "memorial-thank-you-card",
        name: "Memorial thank-you card",
        category: "funeral",
        summary: "For thanking those who attended or sent flowers.",
        description:
          "A folded A6 card on 300gsm stock, with space for a short message inside. Often ordered alongside the order of service so the two match.",
        minimumQuantity: 25,
        sortOrder: 2,
      },
      {
        slug: "attendance-card",
        name: "Attendance card",
        category: "funeral",
        summary: "A keepsake card for those who came to the service.",
        description:
          "A single-sided card carrying the name, dates and a photograph — small enough to keep in a wallet or a frame.",
        minimumQuantity: 25,
        sortOrder: 3,
      },
      {
        slug: "memory-box",
        name: "Memory box",
        category: "funeral",
        summary: "A cloth-covered box for cards, photographs and keepsakes.",
        description:
          "A rigid, cloth-covered box made to hold the order of service, photographs and the cards that arrive afterwards. Printed lid personalised to match the stationery.",
        minimumQuantity: 1,
        sortOrder: 4,
      },
      {
        slug: "wedding-invitation-suite",
        name: "Wedding invitation suite",
        category: "wedding",
        summary: "Invitation, RSVP card and envelope, as one set.",
        description:
          "A complete suite: the invitation, a matching RSVP card and a lined envelope. Choose your stock and finish, and we'll proof the whole set together so the wording and colours match across every piece.",
        minimumQuantity: 50,
        sortOrder: 5,
      },
      {
        slug: "save-the-date",
        name: "Save the date",
        category: "wedding",
        summary: "Sent early, so the right people hold the day.",
        description:
          "A single card, usually posted six to twelve months ahead. Often the first piece we design, and the one that sets the look of everything that follows.",
        minimumQuantity: 50,
        sortOrder: 6,
      },
      {
        slug: "order-of-the-day",
        name: "Order of the day",
        category: "wedding",
        summary: "The running order, for the ceremony or the reception.",
        description:
          "A card or folded booklet setting out the timings, readings and the people involved. Designed to sit on a seat or a table without shouting.",
        minimumQuantity: 50,
        sortOrder: 7,
      },
      {
        slug: "christening-invitation",
        name: "Christening invitation",
        category: "celebration",
        summary: "Simple, warm invitations for a christening or naming day.",
        description:
          "A single card with a matching envelope, kept gentle and uncluttered. Photographs work well here if you have one you like.",
        minimumQuantity: 25,
        sortOrder: 8,
      },
      {
        slug: "anniversary-keepsake-print",
        name: "Anniversary keepsake print",
        category: "celebration",
        summary: "A framed print marking a date worth keeping.",
        description:
          "A single print on heavyweight stock, designed around a date, a place or a few words. Supplied unframed unless you ask otherwise.",
        minimumQuantity: 1,
        sortOrder: 9,
      },
    ])
    .returning({ id: products.id, slug: products.slug });

  const bySlug = Object.fromEntries(
    insertedProducts.map((p) => [p.slug, p.id]),
  );

  await db.insert(productSizes).values([
    { productId: bySlug["order-of-service"], label: "A5 booklet", widthMm: 148, heightMm: 210, sortOrder: 1 },
    { productId: bySlug["order-of-service"], label: "A4 booklet", widthMm: 210, heightMm: 297, sortOrder: 2 },
    { productId: bySlug["memorial-thank-you-card"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["attendance-card"], label: "85 × 55mm", widthMm: 85, heightMm: 55, sortOrder: 1 },
    { productId: bySlug["memory-box"], label: "Standard", widthMm: 250, heightMm: 200, sortOrder: 1 },
    { productId: bySlug["wedding-invitation-suite"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["wedding-invitation-suite"], label: "A5", widthMm: 148, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["wedding-invitation-suite"], label: "Square 148mm", widthMm: 148, heightMm: 148, sortOrder: 3 },
    { productId: bySlug["save-the-date"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["save-the-date"], label: "DL", widthMm: 99, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["order-of-the-day"], label: "DL", widthMm: 99, heightMm: 210, sortOrder: 1 },
    { productId: bySlug["christening-invitation"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["anniversary-keepsake-print"], label: "A4", widthMm: 210, heightMm: 297, sortOrder: 1 },
  ]);

  await db.insert(portfolioItems).values([
    { slug: "willow-order-of-service", title: "Willow Order of Service", category: "funeral", description: "Hand-drawn willow motif, foiled on a 300gsm cover.", sortOrder: 1 },
    { slug: "autumn-memorial-cards", title: "Autumn Memorial Cards", category: "funeral", description: "A warm palette drawn from the family's own photographs.", sortOrder: 2 },
    { slug: "eleanor-and-james-wedding-suite", title: "Eleanor & James, Wedding Suite", category: "wedding", description: "Letterpress invitation with a hand-lined envelope.", sortOrder: 3 },
    { slug: "save-the-date-botanical", title: "Save the Date, Botanical", category: "wedding", description: "Pressed-flower illustration, printed on recycled stock.", sortOrder: 4 },
    { slug: "acknowledgement-cards-linen", title: "Acknowledgement Cards, Linen", category: "funeral", description: "A linen-textured stock, kept deliberately plain.", sortOrder: 5 },
    { slug: "order-of-the-day-coastal", title: "Order of the Day, Coastal", category: "wedding", description: "Muted blues for a clifftop ceremony.", sortOrder: 6 },
    { slug: "memorial-candle-labels", title: "Memorial Candle Labels", category: "funeral", description: "Small-format labels to match the service stationery.", sortOrder: 7 },
    { slug: "rosie-christening-set", title: "Rosie's Christening Set", category: "celebration", description: "Invitations and thank-you cards as one gentle set.", sortOrder: 8 },
    { slug: "golden-anniversary-print", title: "Golden Anniversary Print", category: "celebration", description: "Fifty years, set in gold foil on heavyweight stock.", sortOrder: 9 },
  ]);

  const [enquiry] = await db
    .insert(enquiries)
    .values({
      reference: "ENQ-1042",
      userId: customer.id,
      name: "Jordan Ellis",
      email: customer.email,
      category: "funeral",
      subject: "Custom memorial keepsake box",
      message:
        "We'd like something to keep the order of service and photographs in. Could you quote for one box?",
      estimatedQuantity: 1,
      status: "new",
    })
    .returning({ id: enquiries.id });

  await db.insert(orders).values([
    {
      reference: "MP-1039",
      userId: customer.id,
      enquiryId: enquiry.id,
      status: "awaiting_proof",
      paymentStatus: "paid",
      totalPence: 18500,
      assignedDesignerId: designer.id,
      paperStock: "300gsm Cover",
      finish: "Foil detailing",
      placedAt: now,
    },
    {
      reference: "MP-1036",
      userId: customer.id,
      status: "delivered",
      paymentStatus: "paid",
      totalPence: 9600,
      assignedDesignerId: designer.id,
      placedAt: new Date(now.getTime() - 40 * 86_400_000),
    },
  ]);

  await db.insert(savedItems).values([
    { userId: customer.id, productId: bySlug["memorial-thank-you-card"] },
    { userId: customer.id, productId: bySlug["memory-box"] },
  ]);

  // Pricing — placeholder figures. Confirm all four layers before launch.
  await db.insert(pricingBase).values(
    insertedProducts.map((p) => ({
      productId: p.id,
      minQuantity: 25,
      unitPricePence: 180,
    })),
  );

  await db.insert(pricingVolumeTiers).values([
    { minQuantity: 1, maxQuantity: 49, unitPricePence: 200 },
    { minQuantity: 50, maxQuantity: 99, unitPricePence: 180 },
    { minQuantity: 100, maxQuantity: 199, unitPricePence: 160 },
    { minQuantity: 200, maxQuantity: null, unitPricePence: 140 },
  ]);

  await db.insert(pricingAddons).values([
    { code: "foil", name: "Foil detailing", kind: "finish", mode: "per_unit", pricePence: 45 },
    { code: "letterpress", name: "Letterpress", kind: "finish", mode: "per_unit", pricePence: 80 },
    { code: "envelope-lining", name: "Envelope lining", kind: "extra", mode: "per_unit", pricePence: 30 },
    { code: "wax-seal", name: "Wax seal", kind: "extra", mode: "per_unit", pricePence: 55 },
  ]);

  await db.insert(pricingTurnaround).values([
    { code: "standard", name: "Standard", workingDaysMin: 10, workingDaysMax: 14, surchargePercent: 0, sortOrder: 1 },
    { code: "expedited", name: "Expedited", workingDaysMin: 5, workingDaysMax: 7, surchargePercent: 15, sortOrder: 2 },
    { code: "rush", name: "Rush", workingDaysMin: 2, workingDaysMax: 3, surchargePercent: 35, sortOrder: 3 },
  ]);

  console.log("\nSeeded. Demo accounts (password: %s)", DEMO_PASSWORD);
  console.table([
    { role: "Customer", email: customer.email, signInAt: "/login" },
    { role: "Designer", email: designer.email, signInAt: "/login" },
    { role: "Proofreader", email: proofreader.email, signInAt: "/login" },
    { role: "Admin", email: admin.email, signInAt: "/admin/login" },
  ]);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
