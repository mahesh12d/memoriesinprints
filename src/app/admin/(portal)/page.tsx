import Link from "next/link";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, enquiries, orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { describe, ENQUIRY_STATUS, ORDER_STATUS } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/pricing/money";
import { providerStatus } from "@/lib/payments/checkout";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { RevenueChart, type RevenuePoint } from "@/components/admin/revenue-chart";

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function startOfMonth(offset = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

/** Money taken, by month, from orders that were actually paid. */
async function revenueByMonth(): Promise<RevenuePoint[]> {
  const from = startOfMonth(-5);

  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${orders.placedAt}), 'Mon')`,
      monthStart: sql<string>`date_trunc('month', ${orders.placedAt})`,
      total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
    })
    .from(orders)
    .where(and(eq(orders.paymentStatus, "paid"), gte(orders.placedAt, from)))
    .groupBy(sql`date_trunc('month', ${orders.placedAt})`)
    .orderBy(sql`date_trunc('month', ${orders.placedAt})`);

  return rows.map((row) => ({ label: row.month, amountMinor: row.total }));
}

export default async function AdminDashboardPage() {
  await requireAdmin();

  const thisMonth = startOfMonth();

  const [
    [paidAllTime],
    [paidThisMonth],
    [outstanding],
    [newEnquiries],
    [openOrders],
    [customerCount],
    revenue,
    pipeline,
    recent,
    providers,
  ] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int` })
      .from(orders)
      .where(eq(orders.paymentStatus, "paid")),
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int` })
      .from(orders)
      .where(
        and(eq(orders.paymentStatus, "paid"), gte(orders.placedAt, thisMonth)),
      ),
    db
      .select({ total: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.paymentStatus, "unpaid"),
          sql`${orders.status} <> 'cancelled'`,
        ),
      ),
    db
      .select({ value: count() })
      .from(enquiries)
      .where(eq(enquiries.status, "new")),
    db
      .select({ value: count() })
      .from(orders)
      .where(sql`${orders.status} not in ('delivered', 'cancelled')`),
    db.select({ value: count() }).from(users).where(eq(users.role, "customer")),
    revenueByMonth(),
    db
      .select({ status: enquiries.status, value: count() })
      .from(enquiries)
      .groupBy(enquiries.status),
    db
      .select({
        id: activityEvents.id,
        summary: activityEvents.summary,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .orderBy(desc(activityEvents.createdAt))
      .limit(8),
    providerStatus(),
  ]);

  const openByStatus = await db
    .select({ status: orders.status, value: count() })
    .from(orders)
    .where(sql`${orders.status} not in ('delivered', 'cancelled')`)
    .groupBy(orders.status);

  const tiles = [
    {
      label: "Taken this month",
      value: formatMoney(paidThisMonth?.total ?? 0, "GBP"),
    },
    {
      label: "Taken all time",
      value: formatMoney(paidAllTime?.total ?? 0, "GBP"),
    },
    {
      label: "Still to collect",
      value: formatMoney(outstanding?.total ?? 0, "GBP"),
      href: "/admin/orders?payment=unpaid",
    },
    {
      label: "New enquiries",
      value: String(newEnquiries?.value ?? 0),
      href: "/admin/enquiries?status=new",
    },
    {
      label: "Orders open",
      value: String(openOrders?.value ?? 0),
      href: "/admin/orders",
    },
    {
      label: "Customers",
      value: String(customerCount?.value ?? 0),
      href: "/admin/users?role=customer",
    },
  ];

  const PROVIDER_NAME: Record<string, string> = {
    razorpay: "Razorpay",
    paypal: "PayPal",
  };

  const unconfigured = providers
    .filter((provider) => !provider.configured)
    .map((provider) => PROVIDER_NAME[provider.name] ?? provider.name);

  return (
    <>
      <PortalHeader title="Business Dashboard" />

      <PortalBody>
        <div className="flex flex-col gap-7">
          {unconfigured.length > 0 && (
            <div className="rounded-md border border-pending-deep/25 bg-pending-tint px-5 py-4">
              <p className="text-sm leading-relaxed text-ink-soft">
                <strong className="font-semibold">
                  Payment isn&rsquo;t live yet.
                </strong>{" "}
                {unconfigured.join(" and ")}{" "}
                {unconfigured.length === 1 ? "has" : "have"} no keys set, so
                customers can place an order but can&rsquo;t pay for it online.
                You can still record payments taken elsewhere against an order.
              </p>
            </div>
          )}

          <div className="grid gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => {
              const body = (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                    {tile.label}
                  </span>
                  <span className="font-display text-[24px]">{tile.value}</span>
                </>
              );

              return tile.href ? (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5 transition-colors hover:border-brand-deep/40"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={tile.label}
                  className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5"
                >
                  {body}
                </div>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-md border border-line bg-card p-6">
              <RevenueChart points={revenue} />
            </section>

            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-[15px]">Enquiry Pipeline</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {pipeline.length === 0 && (
                  <li className="text-[13px] text-ink-muted">
                    No enquiries yet.
                  </li>
                )}
                {pipeline.map((row) => {
                  const label = describe(ENQUIRY_STATUS, row.status);
                  return (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3"
                    >
                      <StatusPill tone={label.tone}>{label.label}</StatusPill>
                      <span className="text-[13px] font-semibold">
                        {row.value}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <h2 className="mt-6 font-display text-[15px]">Orders Open</h2>
              <ul className="mt-4 flex flex-col gap-2.5">
                {openByStatus.length === 0 && (
                  <li className="text-[13px] text-ink-muted">
                    Nothing outstanding.
                  </li>
                )}
                {openByStatus.map((row) => {
                  const label = describe(ORDER_STATUS, row.status);
                  return (
                    <li
                      key={row.status}
                      className="flex items-center justify-between gap-3"
                    >
                      <StatusPill tone={label.tone}>{label.label}</StatusPill>
                      <span className="text-[13px] font-semibold">
                        {row.value}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <section className="overflow-hidden rounded-md border border-line bg-card">
            <div className="border-b border-line-soft px-6 py-4">
              <h2 className="font-display text-[15px]">Recent Activity</h2>
            </div>
            {recent.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-muted">
                Nothing has happened yet.
              </p>
            ) : (
              <ul>
                {recent.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-3.5 last:border-b-0"
                  >
                    <span className="text-[13px]">{event.summary}</span>
                    <span className="text-[11px] text-ink-quiet">
                      {dateTimeFormat.format(event.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </PortalBody>
    </>
  );
}
