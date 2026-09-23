import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    payment?: string;
    q?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const {
    status = "all",
    payment = "all",
    q,
    page: pageParam,
  } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const query = q?.trim() ?? "";

  const knownStatus = status in ORDER_STATUS ? status : "all";
  const knownPayment = payment in PAYMENT_STATUS ? payment : "all";

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

  const filters = [
    knownStatus === "all"
      ? undefined
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
    .orderBy(desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((currentPage - 1) * PAGE_SIZE);

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
      header: "Placed",
      hideBelow: "md",
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
          <OrderSearch
            basePath="/admin/orders"
            query={query}
            placeholder="Reference, customer or email"
            keep={{
              status: knownStatus === "all" ? undefined : knownStatus,
              payment: knownPayment === "all" ? undefined : knownPayment,
            }}
            liveTarget="admin-orders-list"
          />

          <FilterTabs
            basePath="/admin/orders"
            current={knownStatus}
            extraParams={{
              payment: knownPayment === "all" ? undefined : knownPayment,
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

          <FilterTabs
            basePath="/admin/orders"
            param="payment"
            current={knownPayment}
            extraParams={{
              status: knownStatus === "all" ? undefined : knownStatus,
              q: query || undefined,
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
            }}
          />
        </div>
      </PortalBody>
    </>
  );
}
