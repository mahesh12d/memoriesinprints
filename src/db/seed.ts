import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { db } from "./index";
import {
  enquiries,
  orders,
  portfolioItems,
  pricingAddons,
  pricingBase,
  pricingTurnaround,
  pricingVolumeTiers,
  productSizes,
  products,
  users,
} from "./schema";

/**
 * Development seed. Everything here is demo data — replace the accounts before
 * this ever touches a production database.
 */
const DEMO_PASSWORD = "printsdemo2026";

async function main() {
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
        minimumQuantity: 25,
        sortOrder: 1,
      },
      {
        slug: "memorial-thank-you-card",
        name: "Memorial thank-you card",
        category: "funeral",
        summary: "For thanking those who attended or sent flowers.",
        minimumQuantity: 25,
        sortOrder: 2,
      },
      {
        slug: "wedding-invitation-suite",
        name: "Wedding invitation suite",
        category: "wedding",
        summary: "Invitation, RSVP card and envelope, as one set.",
        minimumQuantity: 50,
        sortOrder: 3,
      },
      {
        slug: "christening-invitation",
        name: "Christening invitation",
        category: "celebration",
        summary: "Simple, warm invitations for a christening or naming day.",
        minimumQuantity: 25,
        sortOrder: 4,
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
    { productId: bySlug["wedding-invitation-suite"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
    { productId: bySlug["wedding-invitation-suite"], label: "A5", widthMm: 148, heightMm: 210, sortOrder: 2 },
    { productId: bySlug["christening-invitation"], label: "A6", widthMm: 105, heightMm: 148, sortOrder: 1 },
  ]);

  await db.insert(portfolioItems).values([
    { slug: "botanical-wedding-suite", title: "Botanical wedding suite", category: "wedding", sortOrder: 1 },
    { slug: "foil-order-of-service", title: "Foil order of service", category: "funeral", sortOrder: 2 },
    { slug: "letterpress-save-the-dates", title: "Letterpress save-the-dates", category: "wedding", sortOrder: 3 },
    { slug: "memorial-candle-labels", title: "Memorial candle labels", category: "funeral", sortOrder: 4 },
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
