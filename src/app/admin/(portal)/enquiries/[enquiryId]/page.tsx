import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { CATEGORY, describe, ENQUIRY_STATUS, ORDER_STATUS } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { ConvertForm, QuoteForm, StatusForm } from "./enquiry-forms";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function AdminEnquiryDetailPage({
  params,
}: {
  params: Promise<{ enquiryId: string }>;
}) {
  await requireAdmin();
  const { enquiryId } = await params;

  const [enquiry] = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      name: enquiries.name,
      email: enquiries.email,
      phone: enquiries.phone,
      category: enquiries.category,
      subject: enquiries.subject,
      message: enquiries.message,
      eventDate: enquiries.eventDate,
      estimatedQuantity: enquiries.estimatedQuantity,
      status: enquiries.status,
      quotedAmountMinor: enquiries.quotedAmountMinor,
      quotedAt: enquiries.quotedAt,
      quoteNotes: enquiries.quoteNotes,
      createdAt: enquiries.createdAt,
      userId: enquiries.userId,
      accountName: users.name,
    })
    .from(enquiries)
    .leftJoin(users, eq(users.id, enquiries.userId))
    .where(eq(enquiries.id, enquiryId))
    .limit(1);

  if (!enquiry) notFound();

  const raised = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
    })
    .from(orders)
    .where(eq(orders.enquiryId, enquiry.id))
    .orderBy(desc(orders.createdAt));

  const status = describe(ENQUIRY_STATUS, enquiry.status);

  const convertBlockedBy = !enquiry.userId
    ? "This came from a visitor with no account, so there's nobody to own an order. Ask them to sign up, then raise it from their account."
    : raised.length > 0
      ? null
      : enquiry.status === "converted"
        ? "This enquiry has already become an order."
        : null;

  return (
    <>
      <PortalHeader
        title={enquiry.reference}
        actions={
          <Link
            href="/admin/enquiries"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Enquiries
          </Link>
        }
      />

      <PortalBody>
        <div className="grid gap-7 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-md border border-line bg-card p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-lg">{enquiry.subject}</h2>
                  <span className="text-[13px] text-ink-quiet">
                    {CATEGORY[enquiry.category] ?? enquiry.category} · received{" "}
                    {dateTimeFormat.format(enquiry.createdAt)}
                  </span>
                </div>
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </div>

              <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">
                {enquiry.message}
              </p>

              <dl className="mt-6 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] text-ink-quiet">Date of the event</dt>
                  <dd className="text-[14px] font-medium">
                    {enquiry.eventDate
                      ? dateFormat.format(enquiry.eventDate)
                      : "Not given"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] text-ink-quiet">Quantity wanted</dt>
                  <dd className="text-[14px] font-medium">
                    {enquiry.estimatedQuantity ?? "Not given"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-line bg-card p-7">
              <h2 className="font-display text-lg">Quote</h2>
              <p className="mb-5 mt-1 text-[13px] text-ink-muted">
                {enquiry.quotedAt
                  ? `Last quoted ${dateTimeFormat.format(enquiry.quotedAt)}.`
                  : "Nothing quoted yet."}
              </p>
              <QuoteForm
                enquiryId={enquiry.id}
                currentAmount={enquiry.quotedAmountMinor}
                currentNotes={enquiry.quoteNotes}
              />
            </section>

            <section className="rounded-md border border-line bg-card p-7">
              <h2 className="font-display text-lg">Turn This into an Order</h2>
              <p className="mb-5 mt-1 max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
                The quoted figure becomes the order total, and the customer can
                follow it from their account.
              </p>

              {raised.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {raised.map((order) => {
                    const orderStatus = describe(ORDER_STATUS, order.status);
                    return (
                      <li
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] bg-surface-grey px-4 py-3"
                      >
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-[13px] font-semibold text-accent-text"
                        >
                          {order.reference}
                        </Link>
                        <span className="flex items-center gap-3 text-[13px]">
                          {order.totalMinor !== null
                            ? formatMoney(order.totalMinor, order.currency)
                            : "—"}
                          <StatusPill tone={orderStatus.tone}>
                            {orderStatus.label}
                          </StatusPill>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ConvertForm
                  enquiryId={enquiry.id}
                  disabledReason={convertBlockedBy}
                />
              )}
            </section>
          </div>

          <aside className="flex h-fit flex-col gap-6">
            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">Who Sent It</h2>
              <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Name</dt>
                  <dd className="text-right font-semibold">{enquiry.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="break-all text-right">
                    <a
                      href={`mailto:${enquiry.email}`}
                      className="font-semibold text-accent-text"
                    >
                      {enquiry.email}
                    </a>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Phone</dt>
                  <dd className="text-right font-semibold">
                    {enquiry.phone ? (
                      <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a>
                    ) : (
                      "Not given"
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Account</dt>
                  <dd className="text-right font-semibold">
                    {enquiry.accountName ?? "No account"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">Move It Along</h2>
              <div className="mt-4">
                <StatusForm enquiryId={enquiry.id} current={enquiry.status} />
              </div>
            </section>
          </aside>
        </div>
      </PortalBody>
    </>
  );
}
