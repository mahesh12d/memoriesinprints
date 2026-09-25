import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { enquiries } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { CATEGORY, describe, ENQUIRY_STATUS } from "@/lib/admin/labels";
import { formatMoney } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { RecordTable, type Column } from "@/components/admin/record-table";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Row = {
  id: string;
  reference: string;
  name: string;
  email: string;
  category: string;
  subject: string;
  status: string;
  quotedAmountMinor: number | null;
  createdAt: Date;
};

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status = "all" } = await searchParams;

  const counts = await db
    .select({
      status: enquiries.status,
      value: sql<number>`count(*)::int`,
    })
    .from(enquiries)
    .groupBy(enquiries.status);

  const byStatus = new Map(counts.map((row) => [row.status as string, row.value]));
  const total = counts.reduce((sum, row) => sum + row.value, 0);

  const known = status in ENQUIRY_STATUS ? status : "all";

  const rows: Row[] = await db
    .select({
      id: enquiries.id,
      reference: enquiries.reference,
      name: enquiries.name,
      email: enquiries.email,
      category: enquiries.category,
      subject: enquiries.subject,
      status: enquiries.status,
      quotedAmountMinor: enquiries.quotedAmountMinor,
      createdAt: enquiries.createdAt,
    })
    .from(enquiries)
    .where(
      known === "all"
        ? undefined
        : eq(
            enquiries.status,
            known as "new" | "reviewed" | "quoted" | "converted" | "declined" | "cancelled",
          ),
    )
    .orderBy(desc(enquiries.createdAt));

  const columns: Column<Row>[] = [
    { header: "Reference", cell: (row) => row.reference },
    {
      header: "From",
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="text-[12px] text-ink-quiet">{row.email}</span>
        </span>
      ),
    },
    {
      header: "About",
      hideBelow: "lg",
      cell: (row) => (
        <span className="flex flex-col">
          <span className="line-clamp-1">{row.subject}</span>
          <span className="text-[12px] text-ink-quiet">
            {CATEGORY[row.category] ?? row.category}
          </span>
        </span>
      ),
    },
    {
      header: "Received",
      hideBelow: "md",
      cell: (row) => dateFormat.format(row.createdAt),
    },
    {
      header: "Quoted",
      align: "right",
      cell: (row) =>
        row.quotedAmountMinor === null
          ? "—"
          : formatMoney(row.quotedAmountMinor, "GBP"),
    },
    {
      header: "Status",
      align: "right",
      cell: (row) => {
        const label = describe(ENQUIRY_STATUS, row.status);
        return <StatusPill tone={label.tone}>{label.label}</StatusPill>;
      },
    },
  ];

  return (
    <>
      <PortalHeader title="Enquiries" />

      <PortalBody>
        <div className="flex flex-col gap-5">
          <FilterTabs
            basePath="/admin/enquiries"
            current={known}
            options={[
              { value: "all", label: "All", count: total },
              ...Object.entries(ENQUIRY_STATUS).map(([value, label]) => ({
                value,
                label: label.label,
                count: byStatus.get(value) ?? 0,
              })),
            ]}
          />

          <RecordTable
            rows={rows}
            columns={columns}
            hrefFor={(row) => `/admin/enquiries/${row.id}`}
            empty={
              <>
                <h2 className="font-display text-lg">Nothing Here</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  {known === "all"
                    ? "No one has sent an enquiry yet."
                    : "No enquiries with that status."}
                </p>
              </>
            }
          />
        </div>
      </PortalBody>
    </>
  );
}
