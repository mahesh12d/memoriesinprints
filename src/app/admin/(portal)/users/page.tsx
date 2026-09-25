import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { ROLE } from "@/lib/admin/labels";
import { FilterTabs } from "@/components/admin/filter-tabs";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { RecordTable, type Column } from "@/components/admin/record-table";
import { InviteForm, UserRow } from "./user-forms";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  isDisabled: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  orderCount: number;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const session = await requireAdmin();
  const { role = "all" } = await searchParams;

  const known = role in ROLE ? role : "all";

  const counts = await db
    .select({ role: users.role, value: sql<number>`count(*)::int` })
    .from(users)
    .groupBy(users.role);

  const byRole = new Map(counts.map((row) => [row.role as string, row.value]));
  const total = counts.reduce((sum, row) => sum + row.value, 0);

  const rows: Row[] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isDisabled: users.isDisabled,
      emailVerifiedAt: users.emailVerifiedAt,
      lastLoginAt: users.lastLoginAt,
      orderCount: sql<number>`count(${orders.id})::int`,
    })
    .from(users)
    .leftJoin(orders, eq(orders.userId, users.id))
    .where(
      known === "all"
        ? undefined
        : eq(users.role, known as "customer" | "designer" | "proofreader" | "admin"),
    )
    .groupBy(users.id)
    .orderBy(asc(users.name));

  const columns: Column<Row>[] = [
    {
      header: "Name",
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-semibold">
            {row.name}
            {row.id === session.user.id && (
              <span className="ml-2 text-[11px] font-normal text-ink-quiet">
                you
              </span>
            )}
          </span>
          <span className="text-[12px] text-ink-quiet">{row.email}</span>
        </span>
      ),
    },
    {
      header: "Role",
      hideBelow: "sm",
      cell: (row) => ROLE[row.role] ?? row.role,
    },
    {
      header: "Orders",
      hideBelow: "md",
      align: "right",
      cell: (row) => row.orderCount,
    },
    {
      header: "Last signed in",
      hideBelow: "lg",
      align: "right",
      cell: (row) =>
        row.lastLoginAt ? dateFormat.format(row.lastLoginAt) : "Never",
    },
    {
      header: "Account",
      align: "right",
      cell: (row) => (
        <span className="flex flex-wrap justify-end gap-1.5">
          {row.isDisabled && <StatusPill tone="alert">Suspended</StatusPill>}
          {!row.emailVerifiedAt && (
            <StatusPill tone="pending">Unverified</StatusPill>
          )}
          {!row.isDisabled && row.emailVerifiedAt && (
            <StatusPill tone="good">Active</StatusPill>
          )}
        </span>
      ),
    },
    {
      header: "Change",
      align: "right",
      cell: (row) => (
        <UserRow
          userId={row.id}
          name={row.name}
          role={row.role}
          isDisabled={row.isDisabled}
          isYou={row.id === session.user.id}
        />
      ),
    },
  ];

  return (
    <>
      <PortalHeader title="Users" />

      <PortalBody>
        <div className="flex flex-col gap-6">
          <section className="rounded-md border border-line bg-card p-6">
            <h2 className="font-display text-lg">Invite Someone</h2>
            <p className="mb-5 mt-1 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
              They get an email with a link to set their own password. Nobody
              chooses a password on their behalf, and the link is the only way
              in.
            </p>
            <InviteForm />
          </section>

          <FilterTabs
            basePath="/admin/users"
            param="role"
            current={known}
            options={[
              { value: "all", label: "Everyone", count: total },
              ...Object.entries(ROLE).map(([value, label]) => ({
                value,
                label,
                count: byRole.get(value) ?? 0,
              })),
            ]}
          />

          <RecordTable
            rows={rows}
            columns={columns}
            empty={
              <>
                <h2 className="font-display text-lg">Nobody Here</h2>
                <p className="mt-2 text-sm text-ink-muted">
                  No accounts with that role.
                </p>
              </>
            }
          />
        </div>
      </PortalBody>
    </>
  );
}
