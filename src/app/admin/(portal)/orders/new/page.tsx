import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { loadDesigners } from "@/lib/proofs/staff-queries";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ProductionOrderForm } from "./production-form";

export default async function NewProductionOrderPage() {
  await requireAdmin();

  const [customers, designers] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.role, "customer"))
      .orderBy(asc(users.name)),
    loadDesigners(),
  ]);

  return (
    <>
      <PortalHeader
        title="Raise an order"
        actions={
          <Link
            href="/admin/orders"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Orders
          </Link>
        }
      />

      <PortalBody>
        <div className="max-w-3xl rounded-md border border-line bg-card p-7">
          <p className="mb-6 max-w-[64ch] text-[13px] leading-relaxed text-ink-muted">
            For work that came in by phone or at the counter. The price you
            type here is the price that stands — it isn&rsquo;t re-derived from
            the catalogue the way a basket order is.
          </p>

          <ProductionOrderForm customers={customers} designers={designers} />
        </div>
      </PortalBody>
    </>
  );
}
