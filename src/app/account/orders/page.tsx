import Link from "next/link";
import { and, desc, eq, exists, ilike, inArray, ne, not, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderForms, orderItems, orders, proofVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { type PillTone } from "@/components/portal/status-pill";
import { OrderCard } from "@/components/portal/order-card";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { OrderSearch } from "@/components/portal/order-search";
import { Pagination } from "@/components/portal/pagination";
import { formatMoney } from "@/lib/pricing/money";
import { loadOrdersWithLines, repriceOrders } from "@/lib/pricing/reprice";
import { resolveItems } from "@/lib/pricing/resolve";

const STATUS: Record<string, { label: string; tone: PillTone }> = {
  awaiting_price: { label: "Awaiting price", tone: "pending" },
  awaiting_payment: { label: "Awaiting payment", tone: "pending" },
  awaiting_proof: { label: "Proof on its way", tone: "pending" },
  in_production: { label: "In production", tone: "neutral" },
  shipped: { label: "Shipped", tone: "good" },
  delivered: { label: "Delivered", tone: "good" },
  cancelled: { label: "Cancelled", tone: "alert" },
};

/**
 * The three things a customer actually wants to tell apart, as tabs.
 *
 * Not the seven internal statuses: "awaiting_price" and "in_production" are
 * the studio's vocabulary, and a customer scanning a hundred orders only
 * wants to know whether something is waiting on them, whether we are getting
 * on with it, or whether it is finished.
 */
const GROUPS: Record<string, { label: string }> = {
  "needs-you": { label: "Needs you" },
  "with-studio": { label: "With the studio" },
  completed: { label: "Completed" },
};

/**
 * One screen of orders at a time.
 *
 * Every row carries a progress line, its items and a price, so rendering a
 * hundred of them is both a wall to scroll and a lot of work per request.
 */
const PAGE_SIZE = 20;

const PAYMENT: Record<string, { label: string; tone: PillTone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  paid: { label: "Paid", tone: "good" },
  refunded: { label: "Refunded", tone: "alert" },
};

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await requireUser();
  const { status, q, page: pageParam } = await searchParams;

  const asked = status && status in GROUPS ? status : null;
  const query = q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  /**
   * Waiting on the customer: a proof they have not answered, or a bill they
   * have not settled. Expressed in SQL rather than in JavaScript because it
   * has to drive the counts, the filtering and the ordering — and once a
   * customer has a hundred orders, only the ones on the current page are
   * loaded, so filtering in memory would filter the wrong set.
   */
  const NEEDS_YOU = or(
    and(
      eq(orders.status, "awaiting_payment"),
      ne(orders.paymentStatus, "paid"),
    ),
    and(
      eq(orders.status, "awaiting_proof"),
      exists(
        db
          .select({ one: sql`1` })
          .from(proofVersions)
          .where(
            and(
              eq(proofVersions.orderId, orders.id),
              eq(proofVersions.status, "awaiting_customer"),
            ),
          ),
      ),
    ),
  )!;

  const COMPLETED = inArray(orders.status, ["delivered", "cancelled"]);

  const mine = eq(orders.userId, session.user.id);
  const matches = query ? ilike(orders.reference, `%${query}%`) : undefined;

  /**
   * All four counts in one query, so the tabs can say how many are in each
   * group without four round trips or loading every order to count them.
   */
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      needsYou: sql<number>`(count(*) filter (where ${NEEDS_YOU}))::int`,
      completed: sql<number>`(count(*) filter (where ${COMPLETED}))::int`,
    })
    .from(orders)
    .where(mine);

  const total = counts?.total ?? 0;
  const groupCounts: Record<string, number> = {
    "needs-you": counts?.needsYou ?? 0,
    "with-studio": total - (counts?.needsYou ?? 0) - (counts?.completed ?? 0),
    completed: counts?.completed ?? 0,
  };

  /**
   * With no "All" tab there is always exactly one group showing, so arriving
   * without one has to pick. It picks the first that has anything in it —
   * landing on "Needs you" is right when something does, and landing on an
   * empty tab when the other two have orders would just look broken.
   */
  const known =
    asked ??
    (Object.keys(GROUPS).find((key) => (groupCounts[key] ?? 0) > 0) ??
      "needs-you");

  const groupWhere =
    known === "needs-you"
      ? NEEDS_YOU
      : known === "completed"
        ? COMPLETED
        : and(not(NEEDS_YOU), not(COMPLETED));

  const where = and(mine, groupWhere, matches);

  const [filtered] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(orders)
    .where(where);

  const matchingCount = filtered?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const rows = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(where)
    // Newest first. Every row in a group is on the same side of NEEDS_YOU, so
    // there is nothing to float to the top within one.
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  /**
   * Prices are re-derived from the catalogue here rather than frozen at order
   * time, so a correction to a product price reaches existing orders without
   * anyone re-keying it. A paid order is left exactly as it was paid.
   *
   * However long the list, it costs a fixed number of queries, and only the
   * figures that actually moved are written back.
   */
  const lines = await loadOrdersWithLines(rows.map((row) => row.id));

  /**
   * The latest proof per order, so a row can say whether there is anything to
   * look at. One query for the whole list, not one per row.
   */
  const latestProofs = rows.length
    ? await db
        .selectDistinctOn([proofVersions.orderId], {
          orderId: proofVersions.orderId,
          status: proofVersions.status,
        })
        .from(proofVersions)
        .where(
          inArray(
            proofVersions.orderId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(proofVersions.orderId, sql`${proofVersions.versionNumber} desc`)
    : [];

  const proofByOrder = new Map(
    latestProofs.map((proof) => [proof.orderId, proof.status]),
  );

  /**
   * What was actually ordered, for the row's own label.
   *
   * A reference and a date look the same on every line — "MP-1041, placed 3
   * September" tells you nothing about which order it is. What people
   * recognise is the thing they bought, so that is what the row leads with.
   *
   * One query for the whole list.
   */
  const itemRows = rows.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          name: orderItems.nameSnapshot,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(
          inArray(
            orderItems.orderId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(orderItems.nameSnapshot)
    : [];

  /**
   * Every line resolved back to the catalogue, so a row can name the template
   * number or product it came from and link to it. One call for the whole
   * page, not one per order.
   */
  const resolved = await resolveItems(
    rows
      .flatMap((row) => lines.get(row.id) ?? [])
      .map((line) => line.itemKey)
      .filter((key): key is string => Boolean(key)),
    session.user.id,
  );

  /** itemKey -> where that item lives on the site, when it still does. */
  const itemLinks = new Map<
    string,
    { label: string; href: string | null }
  >();
  for (const [, item] of resolved) {
    itemLinks.set(item.key, {
      label:
        item.kind === "portfolio" && item.templateNumber
          ? `Template ${item.templateNumber}`
          : item.name,
      href:
        item.kind === "portfolio" && item.slug
          ? `/portfolio/${item.slug}`
          : item.productId
            ? `/products`
            : null,
    });
  }

  /**
   * Whether this particular row is waiting on the customer, for the card's own
   * highlight. The grouping itself happens in SQL above — this is only what a
   * card needs to know about itself.
   */
  function waitingOnCustomer(row: (typeof rows)[number]): boolean {
    return (
      proofByOrder.get(row.id) === "awaiting_customer" ||
      (row.status === "awaiting_payment" && row.paymentStatus !== "paid")
    );
  }

  /**
   * Which of these orders still need their form sent.
   *
   * One query for the page rather than one per row, and keyed on submittedAt
   * because that is what actually hands the job to the studio — a saved draft
   * is not the same as a sent form.
   */
  const formRows = rows.length
    ? await db
        .select({
          orderId: orderForms.orderId,
          submittedAt: orderForms.submittedAt,
        })
        .from(orderForms)
        .where(
          inArray(
            orderForms.orderId,
            rows.map((row) => row.id),
          ),
        )
    : [];

  const formSent = new Set(
    formRows
      .filter((row) => row.submittedAt !== null)
      .map((row) => row.orderId as string),
  );

  const describes = new Map<string, string>();
  for (const item of itemRows) {
    const existing = describes.get(item.orderId);
    const piece = `${item.name} × ${item.quantity}`;
    describes.set(item.orderId, existing ? `${existing}, ${piece}` : piece);
  }

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

  /**
   * What is owed right now, not what has been spent to date.
   *
   * Only orders that have reached awaiting_payment count: an order still being
   * proofed has a price but nothing is due on it yet, and showing it as owing
   * would ask people to pay for work they have not approved.
   */
  const dueRows = rows.filter(
    (row) => row.status === "awaiting_payment" && row.paymentStatus !== "paid",
  );
  const amountDue = dueRows.reduce(
    (total, row) => total + (priced.get(row.id)?.totalMinor ?? row.totalMinor ?? 0),
    0,
  );
  const dueCurrency =
    priced.get(dueRows[0]?.id ?? "")?.currency ?? dueRows[0]?.currency ?? "GBP";

  return (
    <>
      <PortalHeader title="Orders" />

      <PortalBody>
        {total === 0 ? (
          <div className="rounded-md border border-line bg-card p-10 text-center">
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
            {/* Past a handful of orders, scrolling stops being a way to find one. */}
            <OrderSearch
              basePath="/account/orders"
              query={query}
              placeholder="Order reference"
              keep={{ status: known }}
              liveTarget="account-orders-list"
            />

            <FilterTabs
              basePath="/account/orders"
              current={known}
              alwaysSetParam
              extraParams={{ q: query || undefined }}
              /* Switching group starts at page one; page 7 of "Completed"
                 means nothing in "Needs you". */
              options={Object.entries(GROUPS).map(([value, group]) => ({
                value,
                label: group.label,
                count: groupCounts[value] ?? 0,
              }))}
            />

            <div className="flex gap-[18px]">
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  Orders
                </span>
                <span className="font-display text-[27px]">
                  {matchingCount}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 rounded-md border border-line bg-card p-5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-quiet">
                  Amount due
                </span>
                <span className="font-display text-[27px]">
                  {amountDue > 0 ? formatMoney(amountDue, dueCurrency) : "—"}
                </span>
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-md border border-line bg-card p-10 text-center">
                <h2 className="font-display text-lg">Nothing here</h2>
                <p className="mx-auto mt-2 max-w-[48ch] text-sm leading-relaxed text-ink-muted">
                  {query
                    ? `No order of yours matches “${query}”. Check the reference, or clear the search to see them all.`
                    : known === "needs-you"
                      ? "Nothing needs you at the moment. We'll email you the moment a proof is ready."
                      : "Nothing in this group. Pick another tab to see the rest."}
                </p>
              </div>
            ) : (
              <>
                <ul id="account-orders-list" className="flex flex-col gap-3">
                  {rows.map((row) => {
                    const current = priced.get(row.id);
                    const proofStatus = proofByOrder.get(row.id) ?? null;
                    const canPay =
                      row.status === "awaiting_payment" &&
                      row.paymentStatus !== "paid";

                    return (
                      <OrderCard
                        key={row.id}
                        reference={row.reference}
                        placedAt={row.createdAt}
                        description={describes.get(row.id) ?? row.reference}
                        items={(lines.get(row.id) ?? []).map((line) => ({
                          label:
                            (line.itemKey
                              ? itemLinks.get(line.itemKey)?.label
                              : null) ?? "Item",
                          href: line.itemKey
                            ? (itemLinks.get(line.itemKey)?.href ?? null)
                            : null,
                          quantity: line.quantity,
                        }))}
                        orderedFor={row.orderedFor}
                        status={row.status}
                        proofStatus={proofStatus}
                        totalMinor={current?.totalMinor ?? row.totalMinor}
                        currency={current?.currency ?? row.currency}
                        proofHref={
                          proofStatus ? `/account/orders/${row.id}/proof` : null
                        }
                        payHref={canPay ? `/checkout/${row.id}` : null}
                        formSubmitted={formSent.has(row.id)}
                        orderFormHref={
                          formSent.has(row.id)
                            ? null
                            : `/order-form/${row.id}`
                        }
                        needsYou={waitingOnCustomer(row) || !formSent.has(row.id)}
                        statusLabel={STATUS[row.status]?.label ?? row.status}
                        statusTone={STATUS[row.status]?.tone ?? "neutral"}
                        paymentLabel={
                          PAYMENT[row.paymentStatus]?.label ?? row.paymentStatus
                        }
                        paymentTone={
                          PAYMENT[row.paymentStatus]?.tone ?? "neutral"
                        }
                      />
                    );
                  })}
                </ul>

                <Pagination
                  basePath="/account/orders"
                  page={currentPage}
                  pageCount={pageCount}
                  params={{ status: known, q: query || undefined }}
                />
              </>
            )}
          </div>
        )}
      </PortalBody>
    </>
  );
}

