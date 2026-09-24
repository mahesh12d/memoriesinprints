import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  orderForms,
  orders,
  productSizes,
  products,
  users,
} from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { STUDIO } from "@/lib/studio";
import { OrderForm } from "./order-form";
import type { OrderFormRow, ProductChoice } from "./types";

/** The link is the credential, so nothing here may be cached or shared. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order form",
  robots: { index: false, follow: false, nocache: true },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function OrderFormPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireUser();
  const { orderId } = await params;

  // A malformed id is a 404 rather than a database error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    notFound();
  }

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  const [saved] = await db
    .select()
    .from(orderForms)
    .where(eq(orderForms.orderId, orderId))
    .limit(1);

  /**
   * The delivery address starts as whatever is on the account.
   *
   * A funeral director sends nearly everything to the same place, so the
   * address should already be filled in by the time they reach that part of
   * the form — and still be editable for the order that goes somewhere else.
   */
  const [profile] = await db
    .select({
      name: users.name,
      addressLine1: users.addressLine1,
      addressLine2: users.addressLine2,
      city: users.city,
      postcode: users.postcode,
      country: users.country,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const addressDefaults = {
    shippingName: saved?.shippingName ?? profile?.name ?? "",
    shippingLine1: saved?.shippingLine1 ?? profile?.addressLine1 ?? "",
    shippingLine2: saved?.shippingLine2 ?? profile?.addressLine2 ?? "",
    shippingCity: saved?.shippingCity ?? profile?.city ?? "",
    shippingPostcode: saved?.shippingPostcode ?? profile?.postcode ?? "",
    shippingCountry: saved?.shippingCountry ?? profile?.country ?? "United Kingdom",
  };

  // The picker offers what the studio actually prints today, not a list
  // frozen into the form when it was built.
  const catalogue = await db
    .select({
      slug: products.slug,
      name: products.name,
      size: productSizes.label,
    })
    .from(products)
    .leftJoin(
      productSizes,
      and(
        eq(productSizes.productId, products.id),
        eq(productSizes.isActive, true),
      ),
    )
    .where(
      and(
        eq(products.isActive, true),
        /*
          Keepsakes only. This form is the order of service — offering it
          again under "other pieces", next to a wedding invitation suite,
          is a list nobody on a funeral arrangement needs to read past.
        */
        eq(products.category, "funeral"),
        ne(products.slug, "order-of-service"),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(productSizes.sortOrder));

  const byProduct = new Map<string, ProductChoice>();
  for (const row of catalogue) {
    const entry = byProduct.get(row.slug) ?? {
      slug: row.slug,
      name: row.name,
      sizes: [],
    };
    if (row.size && !entry.sizes.includes(row.size)) entry.sizes.push(row.size);
    byProduct.set(row.slug, entry);
  }

  if (saved?.status === "submitted") {
    return <Received reference={order.reference} at={saved.submittedAt} />;
  }

  const values: OrderFormRow | null = saved
    ? {
        status: saved.status,
        branchName: saved.branchName,
        arrangerName: saved.arrangerName,
        deceasedName: saved.deceasedName,
        dateOfBirth: saved.dateOfBirth,
        dateOfDeath: saved.dateOfDeath,
        ageOfDeceased: saved.ageOfDeceased,
        funeralDate: saved.funeralDate,
        funeralTime: saved.funeralTime,
        venueName: saved.venueName,
        coverDesignCode: saved.coverDesignCode,
        insidePagesCode: saved.insidePagesCode,
        photoOption: saved.photoOption,
        numberOfPages: saved.numberOfPages,
        insidePagesStyle: saved.insidePagesStyle,
        quantity: saved.quantity,
        bespokeDesign: saved.bespokeDesign,
        bespokeDetails: saved.bespokeDetails,
        photoQty: saved.photoQty,
        photoInstructions: saved.photoInstructions,
        attachments: saved.attachments ?? [],
        attachmentKey: saved.attachmentKey,
        attachmentName: saved.attachmentName,
        additionalProducts: saved.additionalProducts,
        backpageInformation: saved.backpageInformation,
        additionalNotes: saved.additionalNotes,
        callbackRequested: saved.callbackRequested,
        callbackPhone: saved.callbackPhone,
      }
    : null;

  return (
    <Shell>
      <header className="flex flex-col gap-4">
        <h1 className="text-[34px] leading-tight">Your order of service</h1>
        <p className="max-w-[62ch] text-[16px] leading-relaxed text-ink-muted">
          Whatever you can tell us helps the design team make a start. There is
          no need to finish it in one go — save it and the link will bring you
          back to what you have written.
        </p>
        <p className="text-[13px] text-ink-quiet">
          Order {order.reference}. If anything here is difficult, call us on{" "}
          {STUDIO.phone} and we will fill it in with you.
        </p>
      </header>

      <OrderForm
        orderId={order.id}
        addressDefaults={addressDefaults}
        saved={values}
        products={[...byProduct.values()]}
      />
    </Shell>
  );
}

function Received({
  reference,
  at,
}: {
  reference: string;
  at: Date | null;
}) {
  return (
    <Shell>
      <div className="flex flex-col gap-4 rounded-md border border-brand-line bg-brand-tint p-10">
        <h1 className="text-[30px] leading-tight">Order form received</h1>
        <p className="max-w-[60ch] text-[16px] leading-relaxed text-ink-muted">
          Thank you. Everything you sent is with the design team, and we will be
          in touch with a proof before anything is printed.
        </p>
        <p className="text-[13px] text-ink-quiet">
          Order {reference}
          {at ? `, received ${dateFormat.format(at)}` : ""}.
        </p>
      </div>

      <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-muted">
        If something needs changing, call the studio on {STUDIO.phone} or reply
        to the email we sent — no need to fill the form in again.
      </p>

      {/*
        Sending the form redirects to the dashboard, so this page is only
        reached by opening the link again afterwards. It still needs a way on.
      */}
      <Link
        href="/account"
        className="w-fit rounded-[2px] bg-brand px-6 py-3 text-[13px] font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
      >
        Go to your account
      </Link>
    </Shell>
  );
}

/**
 * Deliberately not the usual site chrome. Someone arriving here has been sent
 * a link during the worst week of their life; a shop header with a cart and a
 * "Request a quote" button is the wrong thing to put in front of them.
 */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-grey">
      {/*
        Wider than the reading measure the rest of the site uses.

        760px was right when this was one column of questions with a rule
        between each group. As cards holding three fields across, that width
        left a strip of page on either side and stacked dates that belong on
        one line.
      */}
      <main className="mx-auto flex max-w-[1040px] flex-col gap-10 px-4 py-12 sm:px-8 sm:py-16">
        <p className="font-display text-lg font-semibold">Memories in Prints</p>
        {children}
      </main>
    </div>
  );
}
