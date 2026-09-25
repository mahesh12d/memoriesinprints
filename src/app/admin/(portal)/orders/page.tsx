import Link from "next/link";
import { and, asc, desc, eq, ilike, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { describe, ORDER_STATUS, PAYMENT_STATUS } from "@/lib/admin/labels";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { OrderSearch } from "@/components/portal/order-search";
import { RecordTable, type Column } from "@/components/admin/record-table";
import { Pagination } from "@/components/portal/pagination";

/** One screen of orders at a time; the whole book is longer than any scroll. */
const PAGE_SIZE = 25;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Row = {
  id: string;
  reference: string;
  orderedFor: string | null;
  customerName: string;
  customerEmail: string;
  status: string;
  paymentStatus: string;
  totalMinor: number | null;
  currency: string;
  createdAt: Date;
  designerName: string | null;
};

type OrderStatusValue = keyof typeof ORDER_STATUS;
type PaymentStatusValue = keyof typeof PAYMENT_STATUS;

/** Gone from the studio: nothing left to do, so not part of "open". */
const CLOSED: OrderStatusValue[] = ["shipped", "delivered", "cancelled"];
const OPEN = "open";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment?: string;
    sort?: string;
    q?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const {
    status = "all",
    payment = "all",
    sort,
    q,
    page: pageParam,
  } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const query = q?.trim() ?? "";

  /**
   * "Open" is the view the studio actually works in.
   *
   * It is not a status on the order — it is everything that has not left the
   * building. Without it, seeing the live book meant clicking through four
   * separate status pills and holding the totals in your head.
   */
  const knownStatus =
    status === OPEN || status in ORDER_STATUS ? status : "all";
  const knownPayment = payment in PAYMENT_STATUS ? payment : "all";

  // Newest first unless asked otherwise: the order placed this morning is the
  // one being asked about on the phone.
  const oldestFirst = sort === "oldest";

  // The same table twice in one query: once as the customer, once as the
  // designer the order is assigned to.
  const designer = alias(users, "designer");

  const [counts, paymentCounts] = await Promise.all([
    db
      .select({ status: orders.status, value: sql<number>`count(*)::int` })
      .from(orders)
      .groupBy(orders.status),
    db
      .select({
        paymentStatus: orders.paymentStatus,
        value: sql<number>`count(*)::int`,
      })
      .from(orders)
      .groupBy(orders.paymentStatus),
  ]);

  const byStatus = new Map(counts.map((row) => [row.status as string, row.value]));
  const byPayment = new Map(
    paymentCounts.map((row) => [row.paymentStatus as string, row.value]),
  );
  const total = counts.reduce((sum, row) => sum + row.value, 0);
  const openCount = counts
    .filter((row) => !CLOSED.includes(row.status as OrderStatusValue))
    .reduce((sum, row) => sum + row.value, 0);

  const filters = [
    knownStatus === "all"
      ? undefined
      : knownStatus === OPEN
        ? notInArray(orders.status, CLOSED)
        : eq(orders.status, knownStatus as OrderStatusValue),
    knownPayment === "all"
      ? undefined
      : eq(orders.paymentStatus, knownPayment as PaymentStatusValue),
    query
      ? or(
          ilike(orders.reference, `%${query}%`),
          ilike(users.name, `%${query}%`),
          ilike(users.email, `%${query}%`),
        )
      : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  /** How many match, so the pager knows how far it goes. */
  const [matching] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(where);

  const matchingCount = matching?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(matchingCount / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const rows: Row[] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      orderedFor: orders.orderedFor,
      customerName: users.name,
      customerEmail: users.email,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
      designerName: designer.name,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .leftJoin(designer, eq(designer.id, orders.assignedDesignerId))
    .where(where)
    /*
      Placed date, newest at the top, with the reference as the tiebreak so
      two orders taken in the same minute keep a stable order between pages —
      without it, a row can appear on page one and page two of the same list.
    */
    .orderBy(
      oldestFirst ? asc(orders.createdAt) : desc(orders.createdAt),
      oldestFirst ? asc(orders.reference) : desc(orders.reference),
    )
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  const stageLabel =
    knownStatus === OPEN
      ? "open"
      : describe(ORDER_STATUS, knownStatus).label;

  const columns: Column<Row>[] = [
    { header: "Reference", cell: (row) => row.reference },
    {
      header: "Customer",
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-[12px] text-ink-quiet">{row.customerEmail}</span>
        </span>
      ),
    },
    {
      header: "Designer",
      hideBelow: "lg",
      cell: (row) => row.designerName ?? "Unassigned",
    },
    {
      // Never hidden: it is what the list is sorted by, and a sort you
      // cannot see is indistinguishable from no sort at all.
      header: "Placed",
      cell: (row) => dateFormat.format(row.createdAt),
    },
    {
      header: "Total",
      align: "right",
      cell: (row) =>
        row.totalMinor === null
          ? QUOTED_INDIVIDUALLY
          : formatMoney(row.totalMinor, row.currency),
    },
    {
      header: "Payment",
      align: "right",
      cell: (row) => {
        const label = describe(PAYMENT_STATUS, row.paymentStatus);
        return <StatusPill tone={label.tone}>{label.label}</StatusPill>;
      },
    },
    {
      header: "Status",
      align: "right",
      cell: (row) => {
        const label = describe(ORDER_STATUS, row.status);
        return <StatusPill tone={label.tone}>{label.label}</StatusPill>;
      },
    },
  ];

  return (
    <>
      <PortalHeader
        title="Orders"
        actions={
          <Link
            href="/admin/orders/new"
            className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent"
          >
            Raise an order
          </Link>
        }
      />

      <PortalBody>
        <div className="flex flex-col gap-5">
          {/*
            One panel, three labelled parts: what to search, which stage, and
            everything else folded away. It used to be a search box and two
            unlabelled rows of pills, where "Paid" and "Delivered" read as
            alternatives to each other.
          */}
          <div className="flex flex-col gap-5 rounded-md border border-line bg-card p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[260px] flex-1">
                <OrderSearch
                  basePath="/admin/orders"
                  query={query}
                  placeholder="Reference, customer or email"
                  keep={{
                    status: knownStatus === "all" ? undefined : knownStatus,
                    payment: knownPayment === "all" ? undefined : knownPayment,
                    sort: oldestFirst ? "oldest" : undefined,
                  }}
                  liveTarget="admin-orders-list"
                />
              </div>

              {/*
                A plain GET form, so the sort is in the URL like every other
                filter and survives a reload or a link sent to a colleague.
              */}
              <form
                action="/admin/orders"
                className="flex items-center gap-2"
              >
                {knownStatus !== "all" && (
                  <input type="hidden" name="status" value={knownStatus} />
                )}
                {knownPayment !== "all" && (
                  <input type="hidden" name="payment" value={knownPayment} />
                )}
                {query && <input type="hidden" name="q" value={query} />}

                <label
                  htmlFor="sort"
                  className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-quiet"
                >
                  Sort
                </label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={oldestFirst ? "oldest" : "newest"}
                  className="rounded-[3px] border border-field-line bg-surface px-3 py-2 text-[13px]"
                >
                  <option value="newest">Newest placed first</option>
                  <option value="oldest">Oldest placed first</option>
                </select>
                <button
                  type="submit"
                  className="rounded-[2px] border border-field-line px-4 py-2 text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-blue"
                >
                  Apply
                </button>
              </form>
            </div>

            <FilterTabs
              basePath="/admin/orders"
              label="Stage"
              current={knownStatus}
              extraParams={{
                payment: knownPayment === "all" ? undefined : knownPayment,
                q: query || undefined,
                sort: oldestFirst ? "oldest" : undefined,
              }}
              options={[
                { value: "all", label: "All", count: total },
                { value: OPEN, label: "Open", count: openCount },
                ...Object.entries(ORDER_STATUS).map(([value, label]) => ({
                  value,
                  label: label.label,
                  count: byStatus.get(value) ?? 0,
                })),
              ]}
            />

            {/*
              Payment is a second question about the same order, not another
              answer to the first, so it sits behind its own heading — open
              already when it is in use, so a filter can never be on and out
              of sight.
            */}
            <details open={knownPayment !== "all"} className="group">
              <summary className="w-fit cursor-pointer text-[13px] font-semibold text-accent-text">
                Payment
              </summary>
              <div className="pt-3">
                <FilterTabs
                  basePath="/admin/orders"
                  param="payment"
                  current={knownPayment}
                  extraParams={{
                    status: knownStatus === "all" ? undefined : knownStatus,
                    q: query || undefined,
                    sort: oldestFirst ? "oldest" : undefined,
                  }}
                  options={[
                    { value: "all", label: "Any payment" },
                    ...Object.entries(PAYMENT_STATUS).map(([value, label]) => ({
                      value,
                      label: label.label,
                      count: byPayment.get(value) ?? 0,
                    })),
                  ]}
                />
              </div>
            </details>
          </div>

          {/*
            What is actually on screen, in words. With filters, a sort and a
            pager all in play, "25 rows" on its own does not say which 25.
          */}
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
            <span>
              {matchingCount === 0
                ? "No orders match"
                : `${rows.length} of ${matchingCount} ${matchingCount === 1 ? "order" : "orders"}`}
              {knownStatus === "all" ? "" : ` · ${stageLabel}`}
              {knownPayment === "all"
                ? ""
                : ` · ${describe(PAYMENT_STATUS, knownPayment).label}`}
              {query ? ` · matching “${query}”` : ""}
              {" · "}
              {oldestFirst ? "oldest placed first" : "newest placed first"}
            </span>
            {(knownStatus !== "all" || knownPayment !== "all" || query) && (
              <Link
                href="/admin/orders"
                className="font-semibold text-accent-text"
              >
                Clear filters
              </Link>
            )}
          </p>

          <RecordTable
            rows={rows}
            columns={columns}
            listId="admin-orders-list"
            // Reference and customer, which is what staff search by.
            searchText={(row) =>
              `${row.reference} ${row.customerName} ${row.orderedFor ?? ""}`
            }
            hrefFor={(row) => `/admin/orders/${row.id}`}
            empty={
              <>
                <h2 className="font-display text-lg">No orders here</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  {query
                    ? `Nothing matches “${query}”. Try a reference, a name or an email address.`
                    : "Nothing matches those filters."}
                </p>
              </>
            }
          />

          <Pagination
            basePath="/admin/orders"
            page={currentPage}
            pageCount={pageCount}
            params={{
              status: knownStatus === "all" ? undefined : knownStatus,
              payment: knownPayment === "all" ? undefined : knownPayment,
              q: query || undefined,
              sort: oldestFirst ? "oldest" : undefined,
            }}
          />
        </div>
      </PortalBody>
    </>
  );
}
