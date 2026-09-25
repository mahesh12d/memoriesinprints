import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders, payments, proofVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import { signedReadUrl } from "@/lib/storage/storage";
import { Section } from "@/components/site/section";
import { isUuid } from "@/lib/utils";
import { DeliveryAddress } from "./delivery-address";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Everything the customer is about to pay for, on one page, before any money
 * is asked for.
 *
 * Payment is the last step of this flow rather than the first, so by the time
 * someone reaches it they have approved a proof that may have been through
 * several rounds. This is where they check that what was approved, where it is
 * going and when it will arrive are all what they expect — and only then does
 * the next page ask for the money.
 */
export default async function CheckoutOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ provider?: string; stub?: string }>;
}) {
  const session = await requireUser();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();
  const { provider, stub } = await searchParams;

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      paperStock: orders.paperStock,
      finish: orders.finish,
      printMethod: orders.printMethod,
      shipByAt: orders.shipByAt,
      shippingName: orders.shippingName,
      shippingLine1: orders.shippingLine1,
      shippingLine2: orders.shippingLine2,
      shippingCity: orders.shippingCity,
      shippingPostcode: orders.shippingPostcode,
      shippingCountry: orders.shippingCountry,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  const [items, approved, attempts] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        name: orderItems.nameSnapshot,
        size: orderItems.sizeSnapshot,
        quantity: orderItems.quantity,
        lineTotalMinor: orderItems.lineTotalMinor,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id))
      .orderBy(asc(orderItems.nameSnapshot)),

    /**
     * The artwork the customer signed off, not merely the newest file. A proof
     * that came after an approval has not been agreed to, and this page is a
     * record of what was.
     */
    db
      .select({
        versionNumber: proofVersions.versionNumber,
        storageKey: proofVersions.storageKey,
        fileName: proofVersions.fileName,
        mimeType: proofVersions.mimeType,
      })
      .from(proofVersions)
      .where(
        and(
          eq(proofVersions.orderId, order.id),
          eq(proofVersions.status, "approved"),
        ),
      )
      .orderBy(desc(proofVersions.versionNumber))
      .limit(1),

    db
      .select({
        provider: payments.provider,
        providerOrderId: payments.providerOrderId,
        status: payments.status,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1),
  ]);

  const proof = approved[0] ?? null;
  const attempt = attempts[0] ?? null;
  const proofUrl = proof ? await signedReadUrl(proof.storageKey) : null;

  const awaitingPayment =
    order.status === "awaiting_payment" && order.paymentStatus !== "paid";
  const isStub = stub === "1";

  const production = [
    order.paperStock ? { label: "Paper", value: order.paperStock } : null,
    order.finish ? { label: "Finish", value: order.finish } : null,
    order.printMethod ? { label: "Printing", value: order.printMethod } : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  return (
    <Section>
      <div className="mx-auto flex max-w-[1060px] flex-col gap-7 py-4">
        <div className="flex flex-col gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
            Order {order.reference}
          </span>
          <h1 className="text-[32px] leading-tight">
            {order.paymentStatus === "paid"
              ? "Paid — thank you"
              : awaitingPayment
                ? "Check everything over"
                : "Your order is placed"}
          </h1>
          <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-muted">
            {order.paymentStatus === "paid"
              ? "Your order is with our printers. We'll let you know the moment it's on its way."
              : awaitingPayment
                ? "This is what you approved and where it's going. Have a read, and when you're happy, the last step is payment."
                : "Nothing is charged yet. We'll email you the moment your proof is ready to review, and you only pay once you've approved it."}
          </p>
          {order.orderedFor && (
            <p className="text-[14px] text-ink-soft">
              For <strong className="font-semibold">{order.orderedFor}</strong>
            </p>
          )}
        </div>

        {isStub && (
          <div className="rounded-md border border-pending-deep/25 bg-pending-tint p-6">
            <h2 className="font-display text-lg">Payment Isn&rsquo;t Live Yet</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              The order is recorded and sitting as awaiting payment. The{" "}
              {provider === "paypal" ? "PayPal" : "Razorpay"} keys haven&rsquo;t
              been added to this environment, so there was no payment sheet to
              open.
            </p>
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* LEFT: everything there is to check. */}
          <div className="flex flex-col gap-6">
            {proof && (
              <section className="rounded-md border border-line bg-card p-6">
                <h2 className="font-display text-lg">The Design You Approved</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Version {proof.versionNumber} &mdash; this is exactly what
                  goes to print.
                </p>

                {proofUrl && proof.mimeType?.startsWith("image/") ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={proofUrl}
                    alt={`Approved proof, version ${proof.versionNumber}`}
                    className="mt-4 w-full rounded-[3px] border border-line-soft"
                  />
                ) : null}

                {proofUrl && (
                  <Link
                    href={proofUrl}
                    target="_blank"
                    rel="noopener"
                    className="mt-4 inline-flex rounded-[2px] border border-field-line px-5 py-2.5 text-[13px] font-semibold text-ink-soft hover:bg-surface-grey"
                  >
                    Open {proof.fileName ?? "the approved proof"}
                  </Link>
                )}
              </section>
            )}

            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">What You Ordered</h2>

              <ul className="mt-4 flex flex-col divide-y divide-line-soft border-y border-line-soft">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 py-3.5"
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[14px] font-semibold">
                        {item.name}
                      </span>
                      <span className="text-[12px] text-ink-quiet">
                        {item.size ? `${item.size} · ` : ""}
                        {item.quantity} &times;
                      </span>
                    </span>
                    <span className="text-[14px] font-semibold">
                      {item.lineTotalMinor !== null
                        ? formatMoney(item.lineTotalMinor, order.currency)
                        : "—"}
                    </span>
                  </li>
                ))}
              </ul>

              {production.length > 0 && (
                <dl className="mt-5 flex flex-col gap-1.5 text-[13px]">
                  {production.map((row) => (
                    <div key={row.label} className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{row.label}</dt>
                      <dd className="font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">Delivery</h2>
              <p className="mb-4 mt-1 text-[13px] text-ink-muted">
                Taken from your account when you placed this order.
              </p>

              <DeliveryAddress
                orderId={order.id}
                address={{
                  shippingName: order.shippingName,
                  shippingLine1: order.shippingLine1,
                  shippingLine2: order.shippingLine2,
                  shippingCity: order.shippingCity,
                  shippingPostcode: order.shippingPostcode,
                  shippingCountry: order.shippingCountry,
                }}
                editable={
                  order.status !== "shipped" &&
                  order.status !== "delivered" &&
                  order.status !== "cancelled"
                }
              />

              {/*
                The posting date folded in here rather than given a card of its
                own. Alone it was usually an empty box saying it would be
                confirmed later, taking as much room as the address and saying
                less.
              */}
              {order.shipByAt && (
                <p className="mt-3 border-t border-line-soft pt-3 text-[13px] text-ink-muted">
                  Posted to you by{" "}
                  <strong className="font-semibold text-ink-soft">
                    {dateFormat.format(order.shipByAt)}
                  </strong>
                </p>
              )}
            </section>

            {attempt && !awaitingPayment && (
              <dl className="rounded-md border border-line bg-card p-6 text-[13px]">
                <div className="flex justify-between gap-4 py-1.5">
                  <dt className="text-ink-muted">Method</dt>
                  <dd className="font-semibold">{attempt.provider}</dd>
                </div>
                <div className="flex justify-between gap-4 py-1.5">
                  <dt className="text-ink-muted">Provider reference</dt>
                  <dd className="font-mono text-[12px]">
                    {attempt.providerOrderId}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 py-1.5">
                  <dt className="text-ink-muted">Payment status</dt>
                  <dd className="font-semibold">{attempt.status}</dd>
                </div>
              </dl>
            )}
          </div>

          {/*
            RIGHT: the total and the one thing to do next.

            Sticky from lg up, so the amount and the button stay in view
            however far the proof and the line items push the page down. 89px
            clears the 73px header with room to breathe.
          */}
          <aside className="flex flex-col gap-4 rounded-md border border-line bg-card p-6 lg:sticky lg:top-[89px]">
            <StationeryMark />

            <div className="flex items-baseline justify-between border-t border-line-soft pt-4">
              <span className="text-[14px] text-ink-muted">Total</span>
              <span className="font-display text-[28px]">
                {order.totalMinor !== null
                  ? formatMoney(order.totalMinor, order.currency)
                  : "—"}
              </span>
            </div>

            {awaitingPayment ? (
              <>
                {/*
                  No address, no payment. Taking money for something printed
                  and then having nowhere to post it is the one failure here
                  that costs the studio real work, and it is trivially
                  avoidable by asking first.
                */}
                {order.shippingLine1 ? (
                  <Link
                    href={`/checkout/${order.id}/pay`}
                    className="rounded-[2px] bg-brand px-6 py-3.5 text-center text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
                  >
                    Continue to payment
                  </Link>
                ) : (
                  <span className="rounded-[2px] bg-surface-grey px-6 py-3.5 text-center text-sm font-semibold text-ink-pale">
                    Continue to payment
                  </span>
                )}
                <p className="text-[12px] leading-relaxed text-ink-quiet">
                  {order.shippingLine1
                    ? "Printing starts once your payment clears."
                    : "Add a delivery address above and you can pay."}
                </p>
              </>
            ) : (
              <>
                <Link
                  href="/account/orders"
                  className="rounded-[2px] bg-brand px-6 py-3.5 text-center text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
                >
                  See my orders
                </Link>
                <Link
                  href="/products"
                  className="rounded-[2px] border border-field-line px-6 py-3.5 text-center text-sm font-semibold text-ink-soft hover:bg-surface-grey"
                >
                  Keep browsing
                </Link>
              </>
            )}
          </aside>
        </div>
      </div>
    </Section>
  );
}

/**
 * A quiet line drawing of a folded card and a sprig, for the summary panel.
 *
 * Inline SVG rather than an image file: it is two dozen strokes, it inherits
 * the theme's own colours so it is right in both light and dark without a
 * second asset, and it costs no request. Drawn in outline and kept pale on
 * purpose — this sits on a page where someone is arranging a funeral, so it
 * should register as a small piece of craft, not a mascot.
 *
 * Decorative: it repeats nothing the words do not already say, so it is
 * hidden from screen readers rather than given a description to read out.
 */
function StationeryMark() {
  return (
    <svg
      viewBox="0 0 220 110"
      aria-hidden="true"
      focusable="false"
      className="h-[110px] w-full text-ink-pale"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* the open card, seen slightly from above */}
      <path d="M36 82V38l38-14v44z" />
      <path d="M74 68V24l38 14v44z" />
      <path d="M36 82h76" opacity="0.55" />

      {/* a couple of printed lines on the left leaf */}
      <path d="M46 48h18M46 56h12" opacity="0.7" />

      {/* a second card standing behind, to suggest a set rather than one piece */}
      <path d="M126 80V34l34-12v46z" opacity="0.5" />
      <path d="M136 46h14" opacity="0.4" />

      {/* a sprig, for the wedding and funeral work alike */}
      <path d="M176 84c0-18 6-30 18-38" opacity="0.8" />
      <path d="M182 66c-6-1-10-5-11-11 6 0 11 3 13 8" opacity="0.65" />
      <path d="M188 54c-5-3-7-8-6-14 5 2 9 7 9 13" opacity="0.65" />
      <path d="M192 46c2-6 7-9 13-9-1 6-5 10-11 12" opacity="0.65" />

      {/* the desk line */}
      <path d="M20 92h180" opacity="0.35" />
    </svg>
  );
}
