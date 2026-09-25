import Link from "next/link";
import { and, desc, eq, exists, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, orders, proofVersions, users } from "@/db/schema";
import { requireStaff } from "@/lib/auth/guards";
import { canSeeAllOrders } from "@/lib/auth/capabilities";
import { loadQueue } from "@/lib/proofs/staff-queries";
import { groupFor, sortQueue } from "@/lib/proofs/queue";
import { foldActivity } from "@/lib/notifications/bundle";
import { MyQueueList } from "@/components/portal/my-queue";
import { UnseenDot } from "@/components/portal/unseen";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import {
  TurnaroundSparkline,
  type TurnaroundPoint,
} from "@/components/proofs/turnaround-sparkline";

/** Proofs belonging to orders assigned to this designer, and no others. */
function onOrdersOf(designerId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(orders)
      .where(
        and(
          eq(orders.id, proofVersions.orderId),
          eq(orders.assignedDesignerId, designerId),
        ),
      ),
  );
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Average days from a proof reaching the customer to their decision.
 *
 * `designerId` narrows it to one designer's own jobs. A designer is shown
 * their own turnaround, not the studio's: the studio's is an average over
 * work they are not allowed to look at.
 */
async function turnaroundByWeek(
  designerId: string | null,
): Promise<TurnaroundPoint[]> {
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
        designerId ? onOrdersOf(designerId) : undefined,
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

  /**
   * A designer is shown their own work and nothing else.
   *
   * The queue is already scoped for them, but this page was not: the workload
   * panel named every other designer and their open count, and recent
   * activity carried the reference of every order in the studio past them.
   * Who else is busy, and what is happening on jobs they are not on, is for
   * whoever routes the work.
   */
  const routes = canSeeAllOrders(session.user.role);

  const [items, workload, activity, approvedThisMonth, turnaround] =
    await Promise.all([
      loadQueue(session.user),
      routes
        ? db
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
            .orderBy(desc(sql`count(${orders.id})`))
        : Promise.resolve([]),
      db
        .select({
          id: activityEvents.id,
          orderId: activityEvents.orderId,
          summary: activityEvents.summary,
          createdAt: activityEvents.createdAt,
        })
        .from(activityEvents)
        .where(
          routes
            ? undefined
            : // Their own orders only. An event with no order attached is a
              // studio-wide one, and is left out for the same reason.
              exists(
                db
                  .select({ one: sql`1` })
                  .from(orders)
                  .where(
                    and(
                      eq(orders.id, activityEvents.orderId),
                      eq(orders.assignedDesignerId, session.user.id),
                    ),
                  ),
              ),
        )
        .orderBy(desc(activityEvents.createdAt))
        // More than the eight shown: folding a burst on one order collapses
        // several rows into one line, and eight fetched would leave the panel
        // looking emptier than the studio's day was.
        .limit(30),
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
            routes ? undefined : onOrdersOf(session.user.id),
          ),
        ),
      turnaroundByWeek(routes ? null : session.user.id),
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

  /*
    One clock for the sort and every badge on the page, so a row cannot be
    lifted for being overdue while its own badge still reads grey.
  */
  const now = new Date();

  /**
   * The top of the queue, in queue order.
   *
   * Sorted by the same rule the queue page uses and then cut, so the six shown
   * here are genuinely the six to do first — cutting before sorting would show
   * six arbitrary rows under a heading claiming otherwise.
   */
  const topOfQueue = sortQueue(items, viewer, { now })
    .flatMap((group) => group.items)
    .slice(0, 6);

  /*
    The feed's unseen marks come from the queue rows, which already carry this
    viewer's watcher state — no second query, and no chance of the dashboard and
    the queue disagreeing about which orders are new.
  */
  const unseenOrderIds = new Set(
    items.filter((item) => item.unseen).map((item) => item.orderId),
  );

  const feed = foldActivity(activity, unseenOrderIds).slice(0, 8);

  /*
    Every tile now goes somewhere.

    Six numbers that could not be clicked was the complaint underneath all the
    others: they told you four things needed proofreading and then left you to
    find out which four. Each one filters the queue to what it counted, except
    the month's approvals, which are a figure rather than a pile of work.
  */
  const tiles = [
    {
      label: "Waiting on you",
      value: yours,
      href: "/staff/queue?bucket=awaiting_you",
    },
    {
      label: "Needs proofreading",
      value: counts.awaitingProofreading,
      href: routes
        ? "/staff/queue?bucket=awaiting_you"
        : "/staff/queue?bucket=awaiting_customer",
    },
    {
      label: "With the customer",
      value: counts.awaitingCustomer,
      href: "/staff/queue?bucket=awaiting_customer",
    },
    {
      label: "Returned to designer",
      value: counts.returned,
      href: routes
        ? "/staff/queue?bucket=needs_work"
        : "/staff/queue?bucket=awaiting_you",
    },
    {
      label: "Changes requested",
      value: counts.changesRequested,
      href: routes
        ? "/staff/queue?bucket=needs_work"
        : "/staff/queue?bucket=awaiting_you",
    },
    { label: "Approved this month", value: counts.approvedThisMonth },
  ];

  const busiest = Math.max(1, ...workload.map((row) => row.open));

  return (
    <>
      <PortalHeader
        title="Studio Dashboard"
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
          {/*
            A summary strip, not the work surface.

            These stay at the top because a glance at them is worth having, but
            the queue below is what the page is for now — the counts answer "how
            busy am I", and nobody opens this page to ask that.
          */}
          <div className="grid gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => {
              const inner = (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                    {tile.label}
                  </span>
                  <span className="font-display text-[27px]">{tile.value}</span>
                </>
              );

              return tile.href ? (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5 transition-colors hover:border-brand-line hover:bg-brand-tint/40"
                >
                  {inner}
                </Link>
              ) : (
                <div
                  key={tile.label}
                  className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5"
                >
                  {inner}
                </div>
              );
            })}
          </div>

          {/*
            What to open next, above everything else on the page.

            The dashboard used to lead with counters and a sparkline, so the
            first thing anyone saw was a report on work they could not act on
            from here. Capped at six: this is the top of the queue, and the
            queue itself is a click away for the rest.
          */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-[15px]">
                {yours > 0 ? "Waiting on You" : "Your Queue"}
              </h2>
              <Link
                href="/staff/queue"
                className="text-[13px] font-semibold text-accent-text"
              >
                See the whole queue →
              </Link>
            </div>

            <MyQueueList
              items={topOfQueue}
              viewer={viewer}
              now={now}
              emptyTitle="Nothing Needs You Right Now"
              emptyBody="Everything you are on is either with someone else or finished."
            />
          </section>

          <div
            className={`grid gap-6 ${routes ? "lg:grid-cols-[1.4fr_1fr]" : ""}`}
          >
            <section className="rounded-md border border-line bg-card p-6">
              <TurnaroundSparkline points={turnaround} />
            </section>

            {routes && (
            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-[15px]">Designer Workload</h2>
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
            )}
          </div>

          {/*
            The same bundled shape the bell panel uses, so a burst of events on
            one order reads as one line here too — and with the unseen accent on
            the left, which is what the flat list had no way to say.
          */}
          <section className="overflow-hidden rounded-md border border-line bg-card">
            <div className="border-b border-line-soft px-6 py-4">
              <h2 className="font-display text-[15px]">Recent Activity</h2>
            </div>
            {feed.length === 0 ? (
              <p className="px-6 py-5 text-sm text-ink-muted">
                Nothing has happened yet.
              </p>
            ) : (
              <ul>
                {feed.map((entry) => (
                  <li
                    key={entry.id}
                    className={`flex flex-wrap items-center justify-between gap-3 border-b border-line-soft py-3.5 pr-6 last:border-b-0 ${
                      entry.unseen
                        ? "border-l-2 border-l-brand bg-brand-tint/30 pl-[22px]"
                        : "pl-6"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {entry.unseen && <UnseenDot />}
                      {entry.orderId ? (
                        <Link
                          href={`/staff/orders/${entry.orderId}`}
                          className="text-[13px] hover:underline"
                        >
                          {entry.summary}
                        </Link>
                      ) : (
                        <span className="text-[13px]">{entry.summary}</span>
                      )}
                      {entry.folded > 0 && (
                        <span className="shrink-0 text-[11px] text-ink-quiet">
                          · and {entry.folded} more
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-ink-quiet">
                      {dateFormat.format(entry.createdAt)}
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
