import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { canSeeAllOrders, canSeeMoney, requireStaff } from "@/lib/auth/guards";
import { describe, ORDER_STATUS } from "@/lib/admin/labels";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { OrderSearch } from "@/components/portal/order-search";
import { Pagination } from "@/components/portal/pagination";
import { RecordTable, type Column } from "@/components/admin/record-table";

/** One screen of work at a time; a busy month is longer than anyone scrolls. */
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
  designerName: string | null;
  status: string;
  totalMinor: number | null;
  currency: string;
  createdAt: Date;
};

export default async function StaffOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    mine?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const session = await requireStaff();
  const { status = "all", mine, q, page: pageParam } = await searchParams;
  const query = q?.trim() ?? "";
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const known = status in ORDER_STATUS ? status : "all";
  const onlyMine = mine === "1";

  const designer = alias(users, "designer");

  const counts = await db
    .select({ status: orders.status, value: sql<number>`count(*)::int` })
    .from(orders)
    .groupBy(orders.status);

  const byStatus = new Map(counts.map((row) => [row.status as string, row.value]));
  const total = counts.reduce((sum, row) => sum + row.value, 0);

  // A designer's list is their own work, whether or not they asked for it.
  const scoped = canSeeAllOrders(session.user.role);
  const showMoney = canSeeMoney(session.user.role);

  const filters = [
    known === "all"
      ? undefined
      : eq(orders.status, known as keyof typeof ORDER_STATUS),
    !scoped || onlyMine
      ? eq(orders.assignedDesignerId, session.user.id)
      : undefined,
    query
      ? or(ilike(orders.reference, `%${query}%`), ilike(users.name, `%${query}%`))
      : undefined,
  ].filter(Boolean);

  const where = filters.length ? and(...filters) : undefined;

  /**
   * How many match, before any page of them is fetched. A studio with a busy
   * month has more orders than anyone wants in one page, and the count is
   * what tells the pager how far it goes.
   */
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
      designerName: designer.name,
      status: orders.status,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .leftJoin(designer, eq(designer.id, orders.assignedDesignerId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

  const columns: Column<Row>[] = [
    { header: "Reference", cell: (row) => row.reference },
    {
      header: "Customer",
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.customerName}</span>
          {/* Who the order is for, when the customer said. */}
          {row.orderedFor && (
            <span className="text-[12px] text-ink-quiet">
              for {row.orderedFor}
            </span>
          )}
        </span>
      ),
    },
    {
      header: "Designer",
      hideBelow: "md",
      cell: (row) => row.designerName ?? "Unassigned",
    },
    {
      header: "Placed",
      hideBelow: "lg",
      cell: (row) => dateFormat.format(row.createdAt),
    },
    ...(showMoney
      ? [
          {
            header: "Total",
            align: "right" as const,
            hideBelow: "sm" as const,
            cell: (row: Row) =>
              row.totalMinor === null
                ? QUOTED_INDIVIDUALLY
                : formatMoney(row.totalMinor, row.currency),
          },
        ]
      : []),
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
      <PortalHeader title="Orders" />

      <PortalBody>
        <div className="flex flex-col gap-5">
          <OrderSearch
            basePath="/staff/orders"
            query={query}
            placeholder="Reference or customer"
            keep={{
              status: known === "all" ? undefined : known,
              mine: onlyMine ? "1" : undefined,
            }}
            liveTarget="staff-orders-list"
          />

          <FilterTabs
            basePath="/staff/orders"
            current={known}
            extraParams={{
              mine: onlyMine ? "1" : undefined,
              q: query || undefined,
            }}
            options={[
              { value: "all", label: "All", count: total },
              ...Object.entries(ORDER_STATUS).map(([value, label]) => ({
                value,
                label: label.label,
                count: byStatus.get(value) ?? 0,
              })),
            ]}
          />

          {/* A designer only has their own work, so there is nothing to switch. */}
          {scoped && (
          <div className="flex gap-1.5">
            <Link
              href={
                known === "all" ? "/staff/orders" : `/staff/orders?status=${known}`
              }
              aria-current={!onlyMine ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                !onlyMine
                  ? "bg-band text-white"
                  : "border border-line text-ink-muted hover:bg-surface-grey"
              }`}
            >
              Everyone&rsquo;s
            </Link>
            <Link
              href={
                known === "all"
                  ? "/staff/orders?mine=1"
                  : `/staff/orders?status=${known}&mine=1`
              }
              aria-current={onlyMine ? "page" : undefined}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${
                onlyMine
                  ? "bg-band text-white"
                  : "border border-line text-ink-muted hover:bg-surface-grey"
              }`}
            >
              Assigned to me
            </Link>
          </div>
          )}

          <RecordTable
            rows={rows}
            columns={columns}
            listId="staff-orders-list"
            // Reference and customer, which is what staff search by.
            searchText={(row) =>
              `${row.reference} ${row.customerName} ${row.orderedFor ?? ""}`
            }
            hrefFor={(row) => `/staff/orders/${row.id}`}
            empty={
              <>
                <h2 className="font-display text-lg">No orders here</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  {query
                    ? `Nothing matches “${query}”. Try an order reference or a customer's name.`
                    : "Nothing matches those filters."}
                </p>
              </>
            }
          />

          <Pagination
            basePath="/staff/orders"
            page={currentPage}
            pageCount={pageCount}
            params={{
              status: known === "all" ? undefined : known,
              mine: onlyMine ? "1" : undefined,
              q: query || undefined,
            }}
          />
        </div>
      </PortalBody>
    </>
  );
}
