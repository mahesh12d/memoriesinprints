import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  enquiries,
  orderForms,
  productSizes,
  products,
} from "@/db/schema";
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
  params: Promise<{ enquiryId: string }>;
}) {
  const { enquiryId } = await params;

  // A malformed id is a 404 rather than a database error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(enquiryId)) {
    notFound();
  }

  const [enquiry] = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      name: enquiries.name,
    })
    .from(enquiries)
    .where(eq(enquiries.id, enquiryId))
    .limit(1);

  if (!enquiry) notFound();

  const [saved] = await db
    .select()
    .from(orderForms)
    .where(eq(orderForms.enquiryId, enquiryId))
    .limit(1);

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
    .where(eq(products.isActive, true))
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
    return <Received reference={enquiry.reference} at={saved.submittedAt} />;
  }

  const values: OrderFormRow | null = saved
    ? {
        status: saved.status,
        deceasedName: saved.deceasedName,
        dateOfBirth: saved.dateOfBirth,
        dateOfDeath: saved.dateOfDeath,
        ageOfDeceased: saved.ageOfDeceased,
        funeralDate: saved.funeralDate,
        funeralTime: saved.funeralTime,
        venueName: saved.venueName,
        photoOption: saved.photoOption,
        numberOfPages: saved.numberOfPages,
        insidePagesStyle: saved.insidePagesStyle,
        quantity: saved.quantity,
        bespokeDesign: saved.bespokeDesign,
        bespokeDetails: saved.bespokeDetails,
        photoQty: saved.photoQty,
        photoSuppliedVia: saved.photoSuppliedVia,
        photoInstructions: saved.photoInstructions,
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
          Order {enquiry.reference}. If anything here is difficult, call us on{" "}
          {STUDIO.phone} and we will fill it in with you.
        </p>
      </header>

      <OrderForm
        enquiryId={enquiry.id}
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
    <main className="mx-auto flex max-w-[760px] flex-col gap-12 px-6 py-16 sm:px-10 sm:py-24">
      <p className="font-display text-lg font-semibold">Memories in Prints</p>
      {children}
    </main>
  );
}
