import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  orderItems,
  orders,
  payments,
  proofVersions,
  users,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { loadDesigners } from "@/lib/proofs/staff-queries";
import {
  describe,
  ORDER_STATUS,
  PAYMENT_STATUS,
  PROOF_STATUS,
} from "@/lib/admin/labels";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ActivityTimeline } from "@/components/portal/activity-timeline";
import { StatusPill } from "@/components/portal/status-pill";
import { StaffProgress } from "@/components/portal/staff-progress";
import { OrderDetailForm, RecordPaymentForm } from "./order-forms";
import { isUuid } from "@/lib/utils";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  await requireAdmin();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      assignedDesignerId: orders.assignedDesignerId,
      paperStock: orders.paperStock,
      finish: orders.finish,
      printMethod: orders.printMethod,
      productionNotes: orders.productionNotes,
      internalNotes: orders.internalNotes,
      createdAt: orders.createdAt,
      customerId: users.id,
      customerName: users.name,
      customerEmail: users.email,
      customerPhone: users.phone,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) notFound();

  const [lines, proofs, paymentRows, activity, designers] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        nameSnapshot: orderItems.nameSnapshot,
        sizeSnapshot: orderItems.sizeSnapshot,
        quantity: orderItems.quantity,
        lineTotalMinor: orderItems.lineTotalMinor,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId))
      .orderBy(asc(orderItems.nameSnapshot)),
    db
      .select({
        id: proofVersions.id,
        versionNumber: proofVersions.versionNumber,
        status: proofVersions.status,
        createdAt: proofVersions.createdAt,
      })
      .from(proofVersions)
      .where(eq(proofVersions.orderId, orderId))
      .orderBy(desc(proofVersions.versionNumber)),
    db
      .select({
        id: payments.id,
        provider: payments.provider,
        providerPaymentId: payments.providerPaymentId,
        amountMinor: payments.amountMinor,
        currency: payments.currency,
        status: payments.status,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt)),
    db
      .select({
        id: activityEvents.id,
        summary: activityEvents.summary,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(eq(activityEvents.orderId, orderId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(10),
    loadDesigners(),
  ]);

  const status = describe(ORDER_STATUS, order.status);
  const payment = describe(PAYMENT_STATUS, order.paymentStatus);

  return (
    <>
      <PortalHeader
        title={order.reference}
        actions={
          <div className="flex items-center gap-4">
            <Link
              href={`/staff/orders/${order.id}`}
              className="text-[13px] font-semibold text-accent-text"
            >
              Open in the studio
            </Link>
            <Link
              href="/admin/orders"
              className="text-[13px] font-semibold text-accent-text"
            >
              ← Orders
            </Link>
          </div>
        }
      />

      <PortalBody>
        {/* The same job view the studio sees, so admin and staff never
            disagree about where an order has got to. */}
        <section className="mb-7 rounded-md border border-line bg-card p-7">
          <StaffProgress
            status={order.status}
            proofStatus={proofs[0]?.status ?? null}
            hasDesigner={Boolean(order.assignedDesignerId)}
            hasProof={proofs.length > 0}
          />
        </section>

        <div className="flex flex-col gap-8">
          {/*
            Reference across the top, work underneath.

            The customer panel, payments and the rest were a right-hand column
            that never changed, and the forms that do change were squeezed into
            what was left. Full width below, a glance across above.
          */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">Customer</h2>
              <dl className="mt-3 flex flex-col gap-2.5 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Name</dt>
                  <dd className="text-right font-semibold">
                    {order.customerName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="break-all text-right">
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="font-semibold text-accent-text"
                    >
                      {order.customerEmail}
                    </a>
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Phone</dt>
                  <dd className="text-right font-semibold">
                    {order.customerPhone ?? "Not given"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-line-soft pt-2.5">
                  <dt className="text-ink-muted">Total</dt>
                  <dd className="font-semibold">
                    {order.totalMinor === null
                      ? QUOTED_INDIVIDUALLY
                      : formatMoney(order.totalMinor, order.currency)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">
                Proofs ({proofs.length})
              </h2>
              {proofs.length === 0 ? (
                <p className="mt-2 text-[13px] text-ink-muted">
                  Nothing uploaded yet.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {proofs.map((proof) => {
                    const label = describe(PROOF_STATUS, proof.status);
                    return (
                      <li
                        key={proof.id}
                        className="flex items-center justify-between gap-3 text-[13px]"
                      >
                        <span>Version {proof.versionNumber}</span>
                        <StatusPill tone={label.tone}>{label.label}</StatusPill>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

          </div>

          <div className="flex flex-col gap-6">
            {/*
              The order form opens in its own tab rather than sitting on top
              of the controls: it is long, it is read rather than edited, and
              it was pushing everything that is editable below the fold.
            */}
            <a
              href={`/admin/orders/${order.id}/order-form`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
            >
              Open the order form
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 3H3v10h10V9.5" />
                <path d="M9.5 2.5H13.5V6.5" />
                <path d="M13 3 8 8" />
              </svg>
            </a>

            <section className="rounded-md border border-line bg-card p-7">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
                <StatusPill tone={payment.tone}>{payment.label}</StatusPill>
              </div>

              <OrderDetailForm
                orderId={order.id}
                designers={designers}
                values={{
                  status: order.status,
                  assignedDesignerId: order.assignedDesignerId,
                  paperStock: order.paperStock,
                  finish: order.finish,
                  printMethod: order.printMethod,
                  productionNotes: order.productionNotes,
                  internalNotes: order.internalNotes,
                }}
              />
            </section>

            <section className="overflow-hidden rounded-md border border-line bg-card">
              <div className="border-b border-line-soft px-6 py-4">
                <h2 className="font-display text-lg">
                  What was ordered ({lines.length})
                </h2>
              </div>

              {lines.length === 0 ? (
                <p className="px-6 py-5 text-sm text-ink-muted">
                  No lines — this order was raised from an enquiry rather than
                  the basket, so the total is the figure that was quoted.
                </p>
              ) : (
                <ul>
                  {lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4 last:border-b-0"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {line.nameSnapshot}
                        </span>
                        <span className="text-[12px] text-ink-quiet">
                          {line.sizeSnapshot ? `${line.sizeSnapshot} · ` : ""}
                          {line.quantity} ordered
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {line.lineTotalMinor === null
                          ? QUOTED_INDIVIDUALLY
                          : formatMoney(line.lineTotalMinor, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {order.paymentStatus !== "paid" && (
              <section className="rounded-md border border-line bg-card p-7">
                <h2 className="font-display text-lg">
                  Record a Payment Taken Elsewhere
                </h2>
                <p className="mb-5 mt-1 max-w-[58ch] text-[13px] leading-relaxed text-ink-muted">
                  A bank transfer, the card machine in the shop, cash at the
                  counter. This marks the order paid and stops the price being
                  re-derived, so what was paid stays what was agreed.
                </p>
                <RecordPaymentForm
                  orderId={order.id}
                  suggestedAmount={order.totalMinor}
                />
              </section>
            )}

            {paymentRows.length > 0 && (
              <section className="overflow-hidden rounded-md border border-line bg-card">
                <div className="border-b border-line-soft px-6 py-4">
                  <h2 className="font-display text-lg">Payments</h2>
                  {order.paymentStatus === "paid" && (
                    <p className="mt-1 text-[13px] text-good-deep">
                      This order is paid. Nothing more to collect.
                    </p>
                  )}
                </div>
                <ul>
                  {paymentRows.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4 last:border-b-0"
                    >
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">
                          {formatMoney(row.amountMinor, row.currency)}
                        </span>
                        <span className="text-[12px] text-ink-quiet">
                          {row.provider} ·{" "}
                          {row.providerPaymentId ?? "no reference"} ·{" "}
                          {dateTimeFormat.format(row.createdAt)}
                        </span>
                      </span>
                      <StatusPill
                        tone={row.status === "captured" ? "good" : "neutral"}
                      >
                        {row.status}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <ActivityTimeline entries={activity} />
        </div>
      </PortalBody>
    </>
  );
}
