import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { enquiries, orders, products, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [[userCount], [orderCount], [enquiryCount], [productCount], [newEnquiries]] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(orders),
      db.select({ value: count() }).from(enquiries),
      db.select({ value: count() }).from(products),
      db
        .select({ value: count() })
        .from(enquiries)
        .where(eq(enquiries.status, "new")),
    ]);

  const tiles = [
    { label: "Accounts", value: userCount.value },
    { label: "Orders", value: orderCount.value },
    { label: "Enquiries", value: enquiryCount.value },
    { label: "New enquiries", value: newEnquiries.value },
    { label: "Products", value: productCount.value },
  ];

  return (
    <>
      <PortalHeader title="Business dashboard" />

      <PortalBody>
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-5 gap-[18px]">
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

          <div className="rounded-md border border-line bg-white p-8">
            <h2 className="text-lg">Live counts, straight from the database</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
              Revenue figures, the enquiry pipeline and the CRUD screens come
              next. Admin sign-in is already separate from customer sign-in —
              a customer session can&rsquo;t reach this page.
            </p>
          </div>
        </div>
      </PortalBody>
    </>
  );
}
