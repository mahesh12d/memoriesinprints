import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** designer + proofreader are the two "studio staff" roles. */
export const userRole = pgEnum("user_role", [
  "customer",
  "designer",
  "proofreader",
  "admin",
]);

/**
 * Admin sessions are issued by a different login form, live in a different
 * cookie, and are never interchangeable with customer/staff sessions — this is
 * what keeps /admin independent of customer auth.
 */
export const sessionScope = pgEnum("session_scope", ["site", "admin"]);

export const tokenPurpose = pgEnum("token_purpose", [
  "email_verification",
  "password_reset",
]);

export const productCategory = pgEnum("product_category", [
  "funeral",
  "wedding",
  "celebration",
]);

export const enquiryStatus = pgEnum("enquiry_status", [
  "new",
  "reviewed",
  "quoted",
  "converted",
  "declined",
  "cancelled",
]);

export const orderStatus = pgEnum("order_status", [
  "awaiting_price",
  "awaiting_payment",
  "awaiting_proof",
  "in_production",
  "shipped",
  "delivered",
  "cancelled",
]);

export const paymentStatus = pgEnum("payment_status", [
  "unpaid",
  "paid",
  "refunded",
]);

export const orderFormStatus = pgEnum("order_form_status", [
  "draft",
  "submitted",
]);

export const photoOption = pgEnum("photo_option", ["none", "colour", "bw"]);

export const insidePagesStyle = pgEnum("inside_pages_style", [
  "bw",
  "match_cover",
]);

export const photoSuppliedVia = pgEnum("photo_supplied_via", ["email", "post"]);

export const proofStatus = pgEnum("proof_status", [
  "awaiting_proofreading",
  "returned_to_designer",
  "awaiting_customer",
  "approved",
  "changes_requested",
]);

export const paymentProvider = pgEnum("payment_provider", [
  "razorpay",
  "paypal",
]);

export const paymentEventStatus = pgEnum("payment_event_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
]);

export const notificationType = pgEnum("notification_type", [
  "proof_ready",
  "order_status",
  "quote_update",
  "system",
]);

/* -------------------------------------------------------------------------- */
/* People and auth                                                            */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Always stored lowercased and trimmed — see lib/auth/normalise.ts. */
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull().default("customer"),

    // Profile address (the /account/profile form).
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    postcode: text("postcode"),
    country: text("country").default("United Kingdom"),

    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    isDisabled: boolean("is_disabled").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie value. The raw token is never stored. */
    tokenHash: text("token_hash").notNull(),
    scope: sessionScope("scope").notNull().default("site"),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_unique").on(t.tokenHash),
    index("sessions_user_idx").on(t.userId),
  ],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: tokenPurpose("purpose").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("verification_tokens_hash_unique").on(t.tokenHash),
    index("verification_tokens_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: productCategory("category").notNull(),
    summary: text("summary"),
    description: text("description"),
    heroImageUrl: text("hero_image_url"),
    minimumQuantity: integer("minimum_quantity").notNull().default(25),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("products_slug_unique").on(t.slug)],
);

export const productSizes = pgTable(
  "product_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_sizes_product_idx").on(t.productId)],
);

export const portfolioItems = pgTable(
  "portfolio_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: productCategory("category").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),

    /** The studio's own catalogue number for the design. One per piece. */
    templateNumber: integer("template_number"),

    /**
     * What the design is — Classic, Floral, Landscape and so on.
     *
     * One word per piece, and the filter chips on /portfolio are built from
     * the values actually in use, so a new one needs no code and no migration.
     */
    style: varchar("style", { length: 60 }),

    /** Pinned by the studio as a design worth showing first. */
    isPopular: boolean("is_popular").notNull().default(false),

    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("portfolio_items_slug_unique").on(t.slug),
    uniqueIndex("portfolio_items_template_number_unique").on(t.templateNumber),
  ],
);

/**
 * One list per person, holding two kinds of thing: a product they mean to buy
 * and a portfolio design they want to come back to.
 *
 * Both live here rather than in two tables so the saved page is one query and
 * one list. Exactly one of the two ids is set on any row, which the check
 * constraint enforces rather than trusting every future caller to.
 */
export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    portfolioItemId: uuid("portfolio_item_id").references(
      () => portfolioItems.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_items_unique").on(t.userId, t.productId),
    uniqueIndex("saved_items_template_unique").on(t.userId, t.portfolioItemId),
    check(
      "saved_items_one_target",
      sql`(${t.productId} is null) <> (${t.portfolioItemId} is null)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Enquiries → orders                                                         */
/* -------------------------------------------------------------------------- */

export const enquiries = pgTable(
  "enquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    /** Null when the enquiry came from a logged-out visitor. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    category: productCategory("category").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }),
    estimatedQuantity: integer("estimated_quantity"),
    status: enquiryStatus("status").notNull().default("new"),
    quotedAmountMinor: integer("quoted_amount_minor"),
    quotedAt: timestamp("quoted_at", { withTimezone: true }),
    quoteNotes: text("quote_notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("enquiries_reference_unique").on(t.reference),
    index("enquiries_user_idx").on(t.userId),
    index("enquiries_status_idx").on(t.status),
  ],
);

/**
 * What the design team needs to lay out an order of service.
 *
 * Filled in by the family rather than the studio, from a link they are sent
 * once an enquiry becomes an order. The enquiry id in that link is the only
 * credential — there is no account to make and no password to remember at
 * the worst week of someone's life — so the ids are random v4 uuids and the
 * page is kept out of search engines.
 *
 * Exactly one form per enquiry: the unique constraint below is what enforces
 * that, and saving is always an upsert onto it.
 */
export const orderForms = pgTable(
  "order_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enquiryId: uuid("enquiry_id")
      .notNull()
      .references(() => enquiries.id, { onDelete: "cascade" }),
    status: orderFormStatus("status").notNull().default("draft"),

    /* Deceased details */
    deceasedName: varchar("deceased_name", { length: 200 }),
    dateOfBirth: date("date_of_birth"),
    dateOfDeath: date("date_of_death"),
    ageOfDeceased: varchar("age_of_deceased", { length: 60 }),

    /* Service details */
    funeralDate: date("funeral_date"),
    funeralTime: varchar("funeral_time", { length: 60 }),
    venueName: varchar("venue_name", { length: 300 }),

    /* Design */
    photoOption: photoOption("photo_option"),
    numberOfPages: integer("number_of_pages"),
    insidePagesStyle: insidePagesStyle("inside_pages_style"),
    quantity: integer("quantity"),
    bespokeDesign: boolean("bespoke_design").notNull().default(false),
    bespokeDetails: text("bespoke_details"),

    /* Photographs */
    photoQty: integer("photo_qty"),
    photoSuppliedVia: photoSuppliedVia("photo_supplied_via"),
    photoInstructions: text("photo_instructions"),
    /** Object key in storage, never a public URL — reads go through a signed link. */
    attachmentKey: text("attachment_key"),
    attachmentName: text("attachment_name"),

    /* Extras */
    additionalProducts: jsonb("additional_products")
      .$type<{ slug: string; title: string; size: string; quantity: number }[]>()
      .notNull()
      .default([]),
    backpageInformation: text("backpage_information"),
    additionalNotes: text("additional_notes"),
    callbackRequested: boolean("callback_requested").notNull().default(false),
    callbackPhone: varchar("callback_phone", { length: 60 }),

    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("order_forms_enquiry_unique").on(t.enquiryId)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    enquiryId: uuid("enquiry_id").references(() => enquiries.id, {
      onDelete: "set null",
    }),
    status: orderStatus("status").notNull().default("awaiting_price"),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),
    totalMinor: integer("total_minor"),
    currency: text("currency").notNull().default("GBP"),

    assignedDesignerId: uuid("assigned_designer_id").references(() => users.id, {
      onDelete: "set null",
    }),

    // Production details (the staff order form).
    paperStock: text("paper_stock"),
    finish: text("finish"),
    printMethod: text("print_method"),
    productionNotes: text("production_notes"),
    internalNotes: text("internal_notes"),
    proofDueAt: timestamp("proof_due_at", { withTimezone: true }),
    shipByAt: timestamp("ship_by_at", { withTimezone: true }),

    // Delivery address, snapshotted at order time.
    shippingName: text("shipping_name"),
    shippingLine1: text("shipping_line1"),
    shippingLine2: text("shipping_line2"),
    shippingCity: text("shipping_city"),
    shippingPostcode: text("shipping_postcode"),
    shippingCountry: text("shipping_country"),

    placedAt: timestamp("placed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_reference_unique").on(t.reference),
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_designer_idx").on(t.assignedDesignerId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    productSizeId: uuid("product_size_id").references(() => productSizes.id, {
      onDelete: "set null",
    }),
    /**
     * The same key the cart used. Price is never frozen, so this is what the
     * repricer resolves against when the order is displayed.
     */
    itemKey: text("item_key"),
    /** Name and size are snapshotted so an order still reads correctly. */
    nameSnapshot: text("name_snapshot").notNull(),
    sizeSnapshot: text("size_snapshot"),
    quantity: integer("quantity").notNull().default(1),
    unitPriceMinor: integer("unit_price_minor"),
    lineTotalMinor: integer("line_total_minor"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/* -------------------------------------------------------------------------- */
/* Proofs — the core review loop                                              */
/* -------------------------------------------------------------------------- */

export const proofVersions = pgTable(
  "proof_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    /** Object key in R2. Never a public URL — reads go through a signed link. */
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    widthPx: integer("width_px"),
    heightPx: integer("height_px"),

    uploadedById: uuid("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: proofStatus("status").notNull().default("awaiting_proofreading"),

    proofreaderId: uuid("proofreader_id").references(() => users.id, {
      onDelete: "set null",
    }),
    proofreadAt: timestamp("proofread_at", { withTimezone: true }),
    proofreaderNotes: text("proofreader_notes"),

    /**
     * Where the finished artwork was copied when the order completed. Set
     * once and never cleared: this is the copy that outlives the working
     * file, so a completed job can always be reprinted.
     */
    archivedStorageKey: text("archived_storage_key"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    sentToCustomerAt: timestamp("sent_to_customer_at", { withTimezone: true }),
    customerDecisionAt: timestamp("customer_decision_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("proof_versions_order_version_unique").on(
      t.orderId,
      t.versionNumber,
    ),
    index("proof_versions_status_idx").on(t.status),
  ],
);

/** A comment pinned to a point on the proof image, positioned as a percentage. */
export const proofComments = pgTable(
  "proof_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    proofVersionId: uuid("proof_version_id")
      .notNull()
      .references(() => proofVersions.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    /** 0–100, relative to the rendered image, so a pin survives any resize. */
    xPct: doublePrecision("x_pct").notNull(),
    yPct: doublePrecision("y_pct").notNull(),
    pinNumber: integer("pin_number").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("proof_comments_version_idx").on(t.proofVersionId)],
);

/* -------------------------------------------------------------------------- */
/* Payments, notifications, activity                                          */
/* -------------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    providerPaymentId: text("provider_payment_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    status: paymentEventStatus("status").notNull().default("created"),
    rawPayload: jsonb("raw_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    linkUrl: text("link_url"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/** Feeds the staff activity panel and doubles as a light audit trail. */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id").references(() => orders.id, {
      onDelete: "cascade",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_events_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/* Pricing — four tables in two layers                                        */
/* --------------------------------------------------------------------------
 * Base prices are what the public sees. Customer prices are negotiated rates
 * that override the base for one account. A customer price always wins; where
 * neither exists the piece is quoted individually rather than shown as free.
 *
 * Every row carries its own currency, so a negotiated price can be agreed in a
 * different currency from the list price, and each figure is formatted with
 * the currency it was actually stored in.
 * -------------------------------------------------------------------------- */

/** Layer 1, portfolio: the list price of a portfolio piece. */
export const portfolioItemPrices = pgTable(
  "portfolio_item_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioItemId: uuid("portfolio_item_id")
      .notNull()
      .references(() => portfolioItems.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("portfolio_item_prices_item_unique").on(t.portfolioItemId)],
);

/** Layer 2, portfolio: a negotiated price for one customer on one piece. */
export const customerItemPrices = pgTable(
  "customer_item_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    portfolioItemId: uuid("portfolio_item_id")
      .notNull()
      .references(() => portfolioItems.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customer_item_prices_unique").on(t.userId, t.portfolioItemId),
    index("customer_item_prices_user_idx").on(t.userId),
  ],
);

/** Layer 1, products: the list price of one size of one product. */
export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productSizeId: uuid("product_size_id")
      .notNull()
      .references(() => productSizes.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("product_prices_unique").on(t.productId, t.productSizeId),
    index("product_prices_product_idx").on(t.productId),
  ],
);

/** Layer 2, products: a negotiated price for one customer, product and size. */
export const customerProductPrices = pgTable(
  "customer_product_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    productSizeId: uuid("product_size_id")
      .notNull()
      .references(() => productSizes.id, { onDelete: "cascade" }),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("GBP"),
    isActive: boolean("is_active").notNull().default(true),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("customer_product_prices_unique").on(
      t.userId,
      t.productId,
      t.productSizeId,
    ),
    index("customer_product_prices_user_idx").on(t.userId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Cart                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A cart belongs either to an account or to an anonymous browser token. When a
 * guest signs in, their cart is merged into the account's.
 */
export const carts = pgTable(
  "carts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    /** SHA-256 of the guest cookie; null once the cart belongs to an account. */
    guestTokenHash: text("guest_token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("carts_user_unique").on(t.userId),
    uniqueIndex("carts_guest_unique").on(t.guestTokenHash),
  ],
);

/**
 * `itemKey` is the composite `slug::size::templateNumber` for a catalogue
 * product, or a bare portfolio-item UUID. No price is stored: it is always
 * re-derived, so a catalogue change reaches carts without a migration.
 */
export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    itemKey: text("item_key").notNull(),
    quantity: integer("quantity").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("cart_items_unique").on(t.cartId, t.itemKey)],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  orders: many(orders),
  enquiries: many(enquiries),
  savedItems: many(savedItems),
  notifications: many(notifications),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  sizes: many(productSizes),
  prices: many(productPrices),
}));

export const productSizesRelations = relations(productSizes, ({ one }) => ({
  product: one(products, {
    fields: [productSizes.productId],
    references: [products.id],
  }),
}));

export const enquiriesRelations = relations(enquiries, ({ one, many }) => ({
  user: one(users, { fields: [enquiries.userId], references: [users.id] }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  enquiry: one(enquiries, {
    fields: [orders.enquiryId],
    references: [enquiries.id],
  }),
  assignedDesigner: one(users, {
    fields: [orders.assignedDesignerId],
    references: [users.id],
  }),
  items: many(orderItems),
  proofs: many(proofVersions),
  payments: many(payments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const proofVersionsRelations = relations(
  proofVersions,
  ({ one, many }) => ({
    order: one(orders, {
      fields: [proofVersions.orderId],
      references: [orders.id],
    }),
    uploadedBy: one(users, {
      fields: [proofVersions.uploadedById],
      references: [users.id],
    }),
    comments: many(proofComments),
  }),
);

export const proofCommentsRelations = relations(proofComments, ({ one }) => ({
  proofVersion: one(proofVersions, {
    fields: [proofComments.proofVersionId],
    references: [proofVersions.id],
  }),
  author: one(users, {
    fields: [proofComments.authorId],
    references: [users.id],
  }),
}));

export const savedItemsRelations = relations(savedItems, ({ one }) => ({
  user: one(users, { fields: [savedItems.userId], references: [users.id] }),
  product: one(products, {
    fields: [savedItems.productId],
    references: [products.id],
  }),
}));

/* -------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Enquiry = typeof enquiries.$inferSelect;
export type ProofVersion = typeof proofVersions.$inferSelect;
export type ProofComment = typeof proofComments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type ProductPrice = typeof productPrices.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type ProofStatus = (typeof proofStatus.enumValues)[number];
