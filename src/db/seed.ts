import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import {
  activityEvents,
  cartItems,
  carts,
  enquiries,
  notifications,
  orderItems,
  orders,
  orderWatchers,
  payments,
  portfolioItems,
  customerItemPrices,
  customerProductPrices,
  portfolioItemPrices,
  productPrices,
  productSizes,
  products,
  proofComments,
  proofVersions,
  savedItems,
  sessions,
  users,
  verificationTokens,
} from "./schema";
import { CATALOGUE_PRODUCTS, catalogueSizes } from "./catalogue";
import { buildStorageKey } from "@/lib/storage/keys";
import { putObject } from "@/lib/storage/objects";
import { samplePdf, samplePng } from "@/lib/storage/sample-proof";

/**
 * Development seed. It clears everything first, so it can be re-run freely
 * while we're building.
 *
 * Never point this at a production database — it deletes the users table.
 */
const DEMO_PASSWORD = "printsdemo2026";

type SeedOrder = { id: string; reference: string };

/**
 * Puts a proof in each state the studio queue knows about, so the staff and
 * customer screens have something real to show. The artwork is generated
 * rather than committed, and written straight to the local upload directory —
 * in development there is no R2 bucket to put it in.
 */
async function seedProofs({
  customerId,
  designerId,
  proofreaderId,
  orders: seeded,
  now,
}: {
  customerId: string;
  designerId: string;
  proofreaderId: string;
  orders: {
    awaitingCustomer: SeedOrder;
    delivered: SeedOrder;
    needsProofreading: SeedOrder;
    returned: SeedOrder;
    approved: SeedOrder;
  };
  now: Date;
}) {
  /**
   * Writes through the app's own upload path.
   *
   * This used to write straight to .uploads/ on disk. With R2 configured the
   * app serves proofs from signed R2 links instead, so every seeded proof
   * pointed at an object that was not there — the customer got "We couldn't
   * display this proof here" on a file that existed, just not where the app
   * was looking. putObject goes to R2 when it is configured and to disk when
   * it is not, which is the only way the seed and the app can agree.
   */
  async function store(
    fileName: string,
    body: Buffer,
  ): Promise<{ storageKey: string; sizeBytes: number }> {
    const storageKey = buildStorageKey("proofs", fileName);
    const mimeType = fileName.endsWith(".png") ? "image/png" : "application/pdf";

    await putObject(storageKey, body, mimeType);

    return { storageKey, sizeBytes: body.length };
  }

  const memorial = await store(
    "order-of-service-v2.pdf",
    samplePdf("In loving memory", [
      "Elizabeth Anne Hartley",
      "14th March 1946 — 2nd February 2026",
      "St Mary's Church, Tuesday 14th April at 11am",
    ]),
  );
  const thankYou = await store(
    "thank-you-card-v1.pdf",
    samplePdf("With grateful thanks", [
      "The family of Elizabeth Hartley",
      "thank you for your kindness and sympathy",
    ]),
  );
  const attendance = await store("attendance-card-v1.png", samplePng());
  const wedding = await store(
    "invitation-v1.pdf",
    samplePdf("Save the date", [
      "Hannah & Joseph",
      "Saturday 12th September 2026",
    ]),
  );

  const [withCustomer] = await db
    .insert(proofVersions)
    .values([
      {
        orderId: seeded.awaitingCustomer.id,
        versionNumber: 1,
        ...memorial,
        fileName: "order-of-service-v1.pdf",
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "changes_requested",
        proofreaderId,
        proofreadAt: new Date(now.getTime() - 6 * 86_400_000),
        sentToCustomerAt: new Date(now.getTime() - 6 * 86_400_000),
        customerDecisionAt: new Date(now.getTime() - 5 * 86_400_000),
        createdAt: new Date(now.getTime() - 7 * 86_400_000),
      },
      {
        orderId: seeded.awaitingCustomer.id,
        versionNumber: 2,
        ...memorial,
        fileName: "order-of-service-v2.pdf",
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "awaiting_customer",
        proofreaderId,
        proofreadAt: new Date(now.getTime() - 86_400_000),
        sentToCustomerAt: new Date(now.getTime() - 86_400_000),
        createdAt: new Date(now.getTime() - 2 * 86_400_000),
      },
      {
        orderId: seeded.needsProofreading.id,
        versionNumber: 1,
        ...attendance,
        fileName: "attendance-card-v1.png",
        mimeType: "image/png",
        uploadedById: designerId,
        status: "awaiting_proofreading",
        createdAt: new Date(now.getTime() - 5 * 3_600_000),
      },
      {
        orderId: seeded.returned.id,
        versionNumber: 1,
        ...wedding,
        fileName: "invitation-v1.pdf",
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "returned_to_designer",
        proofreaderId,
        proofreadAt: new Date(now.getTime() - 3 * 3_600_000),
        proofreaderNotes:
          "The date reads 12th September but the enquiry says the 19th. Worth checking before this goes out.",
        createdAt: new Date(now.getTime() - 2 * 86_400_000),
      },
      {
        /**
         * Approved by the customer two days ago, which is what moved its order
         * to awaiting_payment. Nothing is printed until that is settled.
         */
        orderId: seeded.approved.id,
        versionNumber: 1,
        ...wedding,
        fileName: "invitation-approved-v1.pdf",
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "approved",
        proofreaderId,
        proofreadAt: new Date(now.getTime() - 3 * 86_400_000),
        sentToCustomerAt: new Date(now.getTime() - 3 * 86_400_000),
        customerDecisionAt: new Date(now.getTime() - 2 * 86_400_000),
        createdAt: new Date(now.getTime() - 3 * 86_400_000),
      },
      {
        orderId: seeded.delivered.id,
        versionNumber: 1,
        ...thankYou,
        fileName: "thank-you-card-v1.pdf",
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "approved",
        proofreaderId,
        proofreadAt: new Date(now.getTime() - 38 * 86_400_000),
        sentToCustomerAt: new Date(now.getTime() - 38 * 86_400_000),
        customerDecisionAt: new Date(now.getTime() - 37 * 86_400_000),
        createdAt: new Date(now.getTime() - 39 * 86_400_000),
      },
    ])
    .returning({ id: proofVersions.id });

  // What the customer marked on the first version, which is why there is a
  // second one.
  await db.insert(proofComments).values([
    {
      proofVersionId: withCustomer.id,
      authorId: customerId,
      body: "Could her middle name be included here? It should read Elizabeth Anne.",
      xPct: 38,
      yPct: 27,
      pinNumber: 1,
      createdAt: new Date(now.getTime() - 5 * 86_400_000),
    },
    {
      proofVersionId: withCustomer.id,
      authorId: customerId,
      body: "The service is at 11am, not 11.30.",
      xPct: 55,
      yPct: 61,
      pinNumber: 2,
      createdAt: new Date(now.getTime() - 5 * 86_400_000),
    },
  ]);

  /**
   * A little history on the delivered order, so the dashboard's turnaround
   * line has more than one week to draw. These are all approved and long past.
   */
  const history = [3.5, 2.5, 4, 1.5, 2, 1] // days from sending to approval
    .map((days, index) => {
      const weeksAgo = 7 - index;
      const sent = new Date(now.getTime() - weeksAgo * 7 * 86_400_000);

      return {
        orderId: seeded.delivered.id,
        versionNumber: index + 2,
        ...thankYou,
        fileName: `archive-v${index + 2}.pdf`,
        mimeType: "application/pdf",
        uploadedById: designerId,
        status: "approved" as const,
        proofreaderId,
        proofreadAt: sent,
        sentToCustomerAt: sent,
        customerDecisionAt: new Date(sent.getTime() + days * 86_400_000),
        createdAt: new Date(sent.getTime() - 86_400_000),
      };
    });

  await db.insert(proofVersions).values(history);

  await db.insert(notifications).values({
    userId: customerId,
    type: "proof_ready",
    orderId: seeded.awaitingCustomer.id,
    title: `Your proof for ${seeded.awaitingCustomer.reference} is ready`,
    body: "Have a look and let us know if anything needs changing.",
    linkUrl: `/account/orders/${seeded.awaitingCustomer.id}/proof`,
    createdAt: new Date(now.getTime() - 86_400_000),
  });

  /*
    Seeded events carry an audience, so a fresh database exercises the queues
    and the bell rather than showing four rows that belong to nobody. The ages
    are chosen to span the aging thresholds: five hours is amber, a day and
    over is red.
  */
  await db.insert(activityEvents).values([
    {
      orderId: seeded.awaitingCustomer.id,
      actorId: proofreaderId,
      type: "proof_sent",
      summary: `Version 2 of ${seeded.awaitingCustomer.reference} sent to the customer`,
      audience: "customer",
      createdAt: new Date(now.getTime() - 86_400_000),
    },
    {
      orderId: seeded.awaitingCustomer.id,
      actorId: customerId,
      type: "changes_requested",
      summary: `Changes requested on ${seeded.awaitingCustomer.reference}`,
      audience: "designer",
      createdAt: new Date(now.getTime() - 5 * 86_400_000),
    },
    {
      orderId: seeded.returned.id,
      actorId: proofreaderId,
      type: "proof_returned",
      summary: `${seeded.returned.reference} returned to the designer`,
      audience: "designer",
      createdAt: new Date(now.getTime() - 3 * 3_600_000),
    },
    {
      orderId: seeded.needsProofreading.id,
      actorId: designerId,
      type: "proof_uploaded",
      summary: `A proof for ${seeded.needsProofreading.reference} is waiting to be proofread`,
      audience: "proofreader",
      createdAt: new Date(now.getTime() - 5 * 3_600_000),
    },
  ]);

  /*
    Each order's clock set to its newest event.

    The column defaults to now(), which would leave every seeded order looking
    as though it had just moved — and the whole point of the dev data is to show
    the difference between one that has and one that has been sitting.
  */
  for (const [orderId, at] of [
    [seeded.awaitingCustomer.id, new Date(now.getTime() - 86_400_000)],
    [seeded.returned.id, new Date(now.getTime() - 3 * 3_600_000)],
    [seeded.needsProofreading.id, new Date(now.getTime() - 5 * 3_600_000)],
  ] as const) {
    await db
      .update(orders)
      .set({ lastActivityAt: at })
      .where(eq(orders.id, orderId));
  }
}

async function reset() {
  // Children before parents; foreign keys are enforced.
  await db.delete(proofComments);
  await db.delete(proofVersions);
  await db.delete(payments);
  await db.delete(orderItems);
  await db.delete(activityEvents);
  await db.delete(orderWatchers);
  await db.delete(orders);
  await db.delete(enquiries);
  await db.delete(savedItems);
  await db.delete(notifications);
  await db.delete(cartItems);
  await db.delete(carts);
  await db.delete(customerProductPrices);
  await db.delete(customerItemPrices);
  await db.delete(productPrices);
  await db.delete(portfolioItemPrices);
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

  // The catalogue itself lives in catalogue.ts, so it can also be imported
  // into a database that already has work in it. See npm run db:catalogue.
  const insertedProducts = await db
    .insert(products)
    .values(CATALOGUE_PRODUCTS)
    .returning({ id: products.id, slug: products.slug });

  const bySlug = Object.fromEntries(
    insertedProducts.map((p) => [p.slug, p.id]),
  );

  await db.insert(productSizes).values(catalogueSizes(bySlug));

  /**
   * Template numbers are the studio's own catalogue numbers and are unique
   * across the whole portfolio, funeral and wedding alike. `style` drives the
   * filter chips: the values in use here are the chips that appear.
   */
  await db.insert(portfolioItems).values([
    { slug: "willow-order-of-service", title: "Willow Order of Service", category: "funeral", description: "Hand-drawn willow motif, foiled on a 300gsm cover.", sortOrder: 1,
      templateNumber: 101, style: "Floral", isPopular: true },
    { slug: "autumn-memorial-cards", title: "Autumn Memorial Cards", category: "funeral", description: "A warm palette drawn from the family's own photographs.", sortOrder: 2,
      templateNumber: 102, style: "Landscape", isPopular: false },
    { slug: "eleanor-and-james-wedding-suite", title: "Eleanor & James, Wedding Suite", category: "wedding", description: "Letterpress invitation with a hand-lined envelope.", sortOrder: 3,
      templateNumber: 201, style: "Classic", isPopular: true },
    { slug: "save-the-date-botanical", title: "Save the Date, Botanical", category: "wedding", description: "Pressed-flower illustration, printed on recycled stock.", sortOrder: 4,
      templateNumber: 202, style: "Floral", isPopular: false },
    { slug: "acknowledgement-cards-linen", title: "Acknowledgement Cards, Linen", category: "funeral", description: "A linen-textured stock, kept deliberately plain.", sortOrder: 5,
      templateNumber: 103, style: "Classic", isPopular: false },
    { slug: "order-of-the-day-coastal", title: "Order of the Day, Coastal", category: "wedding", description: "Muted blues for a clifftop ceremony.", sortOrder: 6,
      templateNumber: 203, style: "Landscape", isPopular: true },
    { slug: "memorial-candle-labels", title: "Memorial Candle Labels", category: "funeral", description: "Small-format labels to match the service stationery.", sortOrder: 7,
      templateNumber: 104, style: "Religious", isPopular: false },
    { slug: "rosie-christening-set", title: "Rosie's Christening Set", category: "celebration", description: "Invitations and thank-you cards as one gentle set.", sortOrder: 8,
      templateNumber: 301, style: "Playful", isPopular: true },
    { slug: "golden-anniversary-print", title: "Golden Anniversary Print", category: "celebration", description: "Fifty years, set in gold foil on heavyweight stock.", sortOrder: 9,
      templateNumber: 302, style: "Classic", isPopular: false },
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

  const [awaitingCustomer, delivered, needsProofreading, returned, approved] =
    await db
    .insert(orders)
    .values([
      {
        reference: "MP-1039",
        userId: customer.id,
        enquiryId: enquiry.id,
        status: "awaiting_proof",
        // Unpaid: the proof is still with the customer, and payment is only
        // asked for once they have approved it.
        paymentStatus: "unpaid",
        totalMinor: 18500,
        assignedDesignerId: designer.id,
        paperStock: "300gsm Cover",
        finish: "Foil detailing",
        shippingName: "Jordan Ellis",
        shippingLine1: "12 Chapel Row",
        shippingCity: "Bristol",
        shippingPostcode: "BS1 4XX",
        shippingCountry: "United Kingdom",
        placedAt: now,
      },
      {
        reference: "MP-1036",
        userId: customer.id,
        status: "delivered",
        paymentStatus: "paid",
        totalMinor: 9600,
        assignedDesignerId: designer.id,
        shippingName: "Jordan Ellis",
        shippingLine1: "12 Chapel Row",
        shippingCity: "Bristol",
        shippingPostcode: "BS1 4XX",
        shippingCountry: "United Kingdom",
        placedAt: new Date(now.getTime() - 40 * 86_400_000),
      },
      {
        reference: "MP-1041",
        userId: customer.id,
        status: "awaiting_proof",
        // Unpaid: the artwork has not even reached the customer yet.
        paymentStatus: "unpaid",
        totalMinor: 14500,
        assignedDesignerId: designer.id,
        shippingName: "Jordan Ellis",
        shippingLine1: "12 Chapel Row",
        shippingCity: "Bristol",
        shippingPostcode: "BS1 4XX",
        shippingCountry: "United Kingdom",
        placedAt: new Date(now.getTime() - 2 * 86_400_000),
      },
      {
        reference: "MP-1042",
        userId: customer.id,
        status: "awaiting_proof",
        paymentStatus: "unpaid",
        totalMinor: 11000,
        assignedDesignerId: designer.id,
        shippingName: "Jordan Ellis",
        shippingLine1: "12 Chapel Row",
        shippingCity: "Bristol",
        shippingPostcode: "BS1 4XX",
        shippingCountry: "United Kingdom",
        placedAt: new Date(now.getTime() - 4 * 86_400_000),
      },
      {
        /**
         * Approved, and now waiting to be paid for — the stage the flow gained
         * when payment moved after proof approval. Without one of these there
         * is nothing to click "Pay now" on, and the step is never exercised.
         */
        reference: "MP-1043",
        userId: customer.id,
        status: "awaiting_payment",
        paymentStatus: "unpaid",
        totalMinor: 22500,
        assignedDesignerId: designer.id,
        /**
         * The same snapshot createOrderFromCart takes from the customer's
         * profile. Without it these demo orders cannot be paid for, because
         * the checkout refuses to take money for something it has nowhere to
         * post.
         */
        shippingName: "Jordan Ellis",
        shippingLine1: "12 Chapel Row",
        shippingCity: "Bristol",
        shippingPostcode: "BS1 4XX",
        shippingCountry: "United Kingdom",
        placedAt: new Date(now.getTime() - 3 * 86_400_000),
      },
    ])
    .returning({ id: orders.id, reference: orders.reference });

  await seedProofs({
    customerId: customer.id,
    designerId: designer.id,
    proofreaderId: proofreader.id,
    orders: { awaitingCustomer, delivered, needsProofreading, returned, approved },
    now,
  });

  await db.insert(savedItems).values([
    { userId: customer.id, productId: bySlug["thank-you-card"] },
    { userId: customer.id, productId: bySlug["memory-boxes"] },
  ]);

  /* ---------------------------------------------------------------- */
  /* Prices — placeholder figures, in two layers                       */
  /* ---------------------------------------------------------------- */

  const sizeRows = await db
    .select({
      id: productSizes.id,
      productId: productSizes.productId,
      label: productSizes.label,
    })
    .from(productSizes);

  // A list price per (product, size). Deliberately not every size: the ones
  // left out exercise the "quoted individually" path.
  const listPrices: Record<string, number> = {
    "order-of-service": 185,
    "memorial-thank-you-card": 120,
    "attendance-card": 95,
    "wedding-invitation-suite": 340,
    "save-the-date": 150,
    "order-of-the-day": 130,
    "christening-invitation": 140,
  };

  const slugById = Object.fromEntries(
    insertedProducts.map((p) => [p.id, p.slug]),
  );

  const productPriceRows = sizeRows
    .map((size) => {
      const slug = slugById[size.productId];
      const base = listPrices[slug];
      if (!base) return null;

      // Larger sizes cost a little more; enough variation to see that pricing
      // really is per size rather than per product.
      const uplift = /A4|A5|Square|Standard/.test(size.label) ? 40 : 0;

      return {
        productId: size.productId,
        productSizeId: size.id,
        amountMinor: base + uplift,
        currency: "GBP",
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  await db.insert(productPrices).values(productPriceRows);

  // One negotiated rate, so the "Your price" path has something to show.
  const orderOfServiceSizes = sizeRows.filter(
    (size) => slugById[size.productId] === "order-of-service",
  );

  await db.insert(customerProductPrices).values(
    orderOfServiceSizes.map((size) => ({
      userId: customer.id,
      productId: size.productId,
      productSizeId: size.id,
      amountMinor: 145,
      currency: "GBP",
      note: "Agreed rate for repeat funeral-home work",
    })),
  );

  const portfolioRows = await db
    .select({ id: portfolioItems.id, slug: portfolioItems.slug })
    .from(portfolioItems);

  // Most portfolio pieces are bespoke and carry no list price at all.
  const pricedPortfolio = portfolioRows.filter((row) =>
    ["willow-order-of-service", "autumn-memorial-cards", "memorial-candle-labels"].includes(
      row.slug,
    ),
  );

  await db.insert(portfolioItemPrices).values(
    pricedPortfolio.map((row, index) => ({
      portfolioItemId: row.id,
      amountMinor: [22000, 9500, 4500][index] ?? 9500,
      currency: "GBP",
    })),
  );

  if (pricedPortfolio[0]) {
    await db.insert(customerItemPrices).values({
      userId: customer.id,
      portfolioItemId: pricedPortfolio[0].id,
      amountMinor: 19500,
      currency: "GBP",
      note: "Negotiated for a repeat commission",
    });
  }

  /**
   * The app takes order references from order_reference_seq. Seeded orders are
   * inserted with explicit references, which the sequence knows nothing about,
   * so on a freshly migrated database it would start handing out MP-1001 and
   * march straight into MP-1036 - and orders.reference is unique, so that is a
   * failed checkout rather than a cosmetic oddity.
   */
  await db.execute(sql`
    select setval(
      'order_reference_seq',
      greatest(
        1000,
        (select coalesce(max(nullif(regexp_replace(reference, '[^0-9]', '', 'g'), '')::bigint), 1000) from orders)
      )
    )
  `);

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
