import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { productSizes, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { CATEGORY } from "@/lib/admin/labels";
import { toggleProductActiveAction } from "@/lib/admin/catalogue-actions";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { RecordTable, type Column } from "@/components/admin/record-table";

type Row = {
  id: string;
  name: string;
  slug: string;
  category: string;
  sizeCount: number;
  minimumQuantity: number;
  isActive: boolean;
};

export default async function AdminProductsPage() {
  await requireAdmin();

  const rows: Row[] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      category: products.category,
      minimumQuantity: products.minimumQuantity,
      isActive: products.isActive,
      sizeCount: sql<number>`count(${productSizes.id})::int`,
    })
    .from(products)
    .leftJoin(productSizes, eq(productSizes.productId, products.id))
    .groupBy(products.id)
    .orderBy(asc(products.sortOrder), asc(products.name));

  const columns: Column<Row>[] = [
    { header: "Product", cell: (row) => row.name },
    {
      header: "Category",
      cell: (row) => CATEGORY[row.category] ?? row.category,
    },
    {
      header: "Address",
      hideBelow: "lg",
      cell: (row) => <span className="text-ink-quiet">/{row.slug}</span>,
    },
    {
      header: "Sizes",
      hideBelow: "md",
      align: "right",
      cell: (row) => row.sizeCount,
    },
    {
      header: "Minimum",
      hideBelow: "md",
      align: "right",
      cell: (row) => row.minimumQuantity,
    },
    {
      header: "On the site",
      align: "right",
      cell: (row) => (
        <form action={toggleProductActiveAction} className="inline">
          <input type="hidden" name="productId" value={row.id} />
          <input type="hidden" name="next" value={String(!row.isActive)} />
          <button
            type="submit"
            aria-label={
              row.isActive
                ? `Hide ${row.name} from the website`
                : `Show ${row.name} on the website`
            }
          >
            <StatusPill tone={row.isActive ? "good" : "neutral"}>
              {row.isActive ? "Live" : "Hidden"}
            </StatusPill>
          </button>
        </form>
      ),
    },
  ];

  return (
    <>
      <PortalHeader
        title="Products"
        actions={
          <Link
            href="/admin/products/new"
            className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent"
          >
            Add a product
          </Link>
        }
      />

      <PortalBody>
        <RecordTable
          rows={rows}
          columns={columns}
          hrefFor={(row) => `/admin/products/${row.id}`}
          empty={
            <>
              <h2 className="font-display text-lg">Nothing in the Catalogue</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Add the first product and it appears on the website straight
                away.
              </p>
            </>
          }
        />
      </PortalBody>
    </>
  );
}
