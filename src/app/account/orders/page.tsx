import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill, type PillTone } from "@/components/portal/status-pill";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { loadOrdersWithLines, repriceOrders } from "@/lib/pricing/reprice";

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  awaiting_price: { label: "Awaiting price", tone: "pending" },
  awaiting_payment: { label: "Awaiting payment", tone: "pending" },
  awaiting_proof: { label: "Proof on its way", tone: "pending" },
  in_production: { label: "In production", tone: "neutral" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "alert" },
};

const PAYMENT: Record<string, { label: string; tone: PillTone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  paid: { label: "Paid", tone: "good" },
  refunded: { label: "Refunded", tone: "alert" },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function AccountOrdersPage() {
  const session = await requireUser();

  const rows = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(eq(orders.userId, session.user.id))
    .orderBy(desc(orders.createdAt));

  /**
   * Prices are re-derived from the catalogue here rather than frozen at order
   * time, so a correction to a product price reaches existing orders without
   * anyone re-keying it. A paid order is left exactly as it was paid.
   *
   * However long the list, it costs a fixed number of queries, and only the
   * figures that actually moved are written back.
   */
  const lines = await loadOrdersWithLines(rows.map((row) => row.id));

  const outcomes = await repriceOrders(
    rows.map((row) => ({
      id: row.id,
      userId: session.user.id,
      paymentStatus: row.paymentStatus,
      totalMinor: row.totalMinor,
      currency: row.currency,
      items: lines.get(row.id) ?? [],
    })),
    session.user.id,
  );

  const priced = new Map(
    outcomes.map((outcome) => [
      outcome.order.id,
      { totalMinor: outcome.totalMinor, currency: outcome.currency },
    ]),
  );

  const paidRows = rows.filter((row) => row.paymentStatus === "paid");
  const spend = paidRows.reduce((total, row) => total + (row.totalMinor ?? 0), 0);
  const spendCurrency = paidRows[0]?.currency ?? "GBP";

  return (
    <>
      <PortalHeader title="Orders" />

      <PortalBody>
        {rows.length === 0 ? (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <h2 className="font-display text-lg">No orders yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              Anything you order appears here, and you&rsquo;ll be able to
              follow it from proof through to delivery.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-[2px] bg-brand px-6 py-3 text-[13px] font-semibold text-on-accent"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex gap-[18px]">
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-white p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  Orders
                </span>
                <span className="font-display text-[27px]">{rows.length}</span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-white p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  Total spend
                </span>
                <span className="font-display text-[27px]">
                  {formatMoney(spend, spendCurrency)}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-line bg-white">
              <ul>
                {rows.map((row) => {
                  const current = priced.get(row.id);
                  const totalMinor = current?.totalMinor ?? row.totalMinor;
                  const currency = current?.currency ?? row.currency;

                  return (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-7 py-5 last:border-b-0"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">
                          {row.reference}
                        </span>
                        <span className="text-xs text-ink-quiet">
                          Placed {dateFormat.format(row.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-sm font-semibold">
                          {totalMinor !== null
                            ? formatMoney(totalMinor, currency)
                            : QUOTED_INDIVIDUALLY}
                        </span>
                        <StatusPill
                          tone={PAYMENT[row.paymentStatus]?.tone ?? "neutral"}
                        >
                          {PAYMENT[row.paymentStatus]?.label ??
                            row.paymentStatus}
                        </StatusPill>
                        <StatusPill
                          tone={STATUS[row.status]?.tone ?? "neutral"}
                        >
                          {STATUS[row.status]?.label ?? row.status}
                        </StatusPill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </PortalBody>
    </>
  );
}
