import Link from "next/link";
import { and, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, orders, proofVersions, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth/guards";
import { loadQueue } from "@/lib/proofs/staff-queries";
import { groupFor } from "@/lib/proofs/queue";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import {
  TurnaroundSparkline,
  type TurnaroundPoint,
} from "@/components/proofs/turnaround-sparkline";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Average days from a proof reaching the customer to their decision. */
async function turnaroundByWeek(): Promise<TurnaroundPoint[]> {
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 86_400_000);

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${proofVersions.customerDecisionAt}), 'DD Mon')`,
      weekStart: sql<string>`date_trunc('week', ${proofVersions.customerDecisionAt})`,
      avgDays: sql<number>`avg(
        extract(epoch from (${proofVersions.customerDecisionAt} - ${proofVersions.sentToCustomerAt})) / 86400
      )::float`,
    })
    .from(proofVersions)
    .where(
      and(
        isNotNull(proofVersions.customerDecisionAt),
        isNotNull(proofVersions.sentToCustomerAt),
        gte(proofVersions.customerDecisionAt, eightWeeksAgo),
      ),
    )
    .groupBy(sql`date_trunc('week', ${proofVersions.customerDecisionAt})`)
    .orderBy(sql`date_trunc('week', ${proofVersions.customerDecisionAt})`);

  return rows.map((row) => ({
    label: row.week,
    days: row.avgDays === null ? null : Number(row.avgDays),
  }));
}

export default async function StaffDashboardPage() {
  const session = await requireStaff();
  const viewer = {
    id: session.user.id,
    role: session.user.role as "designer" | "proofreader",
  };

  const [items, workload, activity, approvedThisMonth, turnaround] =
    await Promise.all([
      loadQueue(),
      db
        .select({
          designerId: users.id,
          name: users.name,
          open: sql<number>`count(${orders.id})::int`,
        })
        .from(users)
        .leftJoin(
          orders,
          and(
            eq(orders.assignedDesignerId, users.id),
            sql`${orders.status} not in ('delivered', 'shipped', 'cancelled')`,
          ),
        )
        .where(eq(users.role, "designer"))
        .groupBy(users.id, users.name)
        .orderBy(desc(sql`count(${orders.id})`)),
      db
        .select({
          id: activityEvents.id,
          summary: activityEvents.summary,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .orderBy(desc(activityEvents.createdAt))
        .limit(8),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(proofVersions)
        .where(
          and(
            eq(proofVersions.status, "approved"),
            gte(
              proofVersions.customerDecisionAt,
              new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            ),
          ),
        ),
      turnaroundByWeek(),
    ]);

  const counts = {
    awaitingProofreading: items.filter(
      (item) => item.proofStatus === "awaiting_proofreading",
    ).length,
    awaitingCustomer: items.filter(
      (item) => item.proofStatus === "awaiting_customer",
    ).length,
    returned: items.filter(
      (item) => item.proofStatus === "returned_to_designer",
    ).length,
    changesRequested: items.filter(
      (item) => item.proofStatus === "changes_requested",
    ).length,
    approvedThisMonth: approvedThisMonth[0]?.count ?? 0,
  };

  const yours = items.filter(
    (item) => groupFor({ ...item }, viewer) === "awaiting_you",
  ).length;

  const tiles = [
    { label: "Waiting on you", value: yours, href: "/staff/queue" },
    { label: "Needs proofreading", value: counts.awaitingProofreading },
    { label: "With the customer", value: counts.awaitingCustomer },
    { label: "Returned to designer", value: counts.returned },
    { label: "Changes requested", value: counts.changesRequested },
    { label: "Approved this month", value: counts.approvedThisMonth },
  ];

  const busiest = Math.max(1, ...workload.map((row) => row.open));

  return (
    <>
      <PortalHeader
        title="Studio dashboard"
        actions={
          <Link
            href="/staff/queue"
            className="text-[13px] font-semibold text-accent-text"
          >
            Open the queue →
          </Link>
        }
      />

      <PortalBody>
        <div className="flex flex-col gap-7">
          <div className="grid gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="flex flex-col gap-1.5 rounded-md border border-line bg-white p-5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  {tile.label}
                </span>
                <span className="font-display text-[27px]">{tile.value}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-md border border-line bg-white p-6">
              <TurnaroundSparkline points={turnaround} />
            </section>

            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-[15px]">Designer workload</h2>
              <ul className="mt-4 flex flex-col gap-3.5">
                {workload.map((row) => (
                  <li key={row.designerId} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[13px]">
                      <span>{row.name}</span>
                      <span className="font-semibold">{row.open} open</span>
                    </div>
                    <div className="h-[7px] w-full overflow-hidden rounded-full bg-surface-grey">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${(row.open / busiest) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
                {workload.length === 0 && (
                  <li className="text-[13px] text-ink-muted">
                    No designers set up yet.
                  </li>
                )}
              </ul>
            </section>
          </div>

          <section className="overflow-hidden rounded-md border border-line bg-white">
            <div className="border-b border-line-soft px-6 py-4">
              <h2 className="font-display text-[15px]">Recent activity</h2>
            </div>
            {activity.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-muted">
                Nothing has happened yet.
              </p>
            ) : (
              <ul>
                {activity.map((event) => (
                  <li
                    key={event.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-3.5 last:border-b-0"
                  >
                    <span className="text-[13px]">{event.summary}</span>
                    <span className="text-[11px] text-ink-quiet">
                      {dateFormat.format(event.createdAt)}
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
