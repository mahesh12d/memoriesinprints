import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { CATEGORY } from "@/lib/admin/labels";
import { togglePortfolioPublishedAction } from "@/lib/admin/catalogue-actions";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { RecordTable, type Column } from "@/components/admin/record-table";

type Row = {
  id: string;
  title: string;
  slug: string;
  category: string;
  isPublished: boolean;
  hasImage: boolean;
};

export default async function AdminPortfolioPage() {
  await requireAdmin();

  const items = await db
    .select({
      id: portfolioItems.id,
      title: portfolioItems.title,
      slug: portfolioItems.slug,
      category: portfolioItems.category,
      isPublished: portfolioItems.isPublished,
      imageUrl: portfolioItems.imageUrl,
    })
    .from(portfolioItems)
    .orderBy(asc(portfolioItems.sortOrder), asc(portfolioItems.title));

  const rows: Row[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    category: item.category,
    isPublished: item.isPublished,
    hasImage: Boolean(item.imageUrl),
  }));

  const columns: Column<Row>[] = [
    { header: "Piece", cell: (row) => row.title },
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
      header: "Photograph",
      hideBelow: "md",
      align: "right",
      cell: (row) =>
        row.hasImage ? (
          "Yes"
        ) : (
          <span className="text-pending-deep">Missing</span>
        ),
    },
    {
      header: "In the portfolio",
      align: "right",
      cell: (row) => (
        <form action={togglePortfolioPublishedAction} className="inline">
          <input type="hidden" name="itemId" value={row.id} />
          <input type="hidden" name="next" value={String(!row.isPublished)} />
          <button
            type="submit"
            aria-label={
              row.isPublished
                ? `Hide ${row.title} from the portfolio`
                : `Show ${row.title} in the portfolio`
            }
          >
            <StatusPill tone={row.isPublished ? "good" : "neutral"}>
              {row.isPublished ? "Published" : "Hidden"}
            </StatusPill>
          </button>
        </form>
      ),
    },
  ];

  return (
    <>
      <PortalHeader
        title="Portfolio"
        actions={
          <Link
            href="/admin/portfolio/new"
            className="rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent"
          >
            Add a piece
          </Link>
        }
      />

      <PortalBody>
        <RecordTable
          rows={rows}
          columns={columns}
          hrefFor={(row) => `/admin/portfolio/${row.id}`}
          empty={
            <>
              <h2 className="font-display text-lg">No Work Shown Yet</h2>
              <p className="mt-2 text-sm text-ink-muted">
                Add a piece to start building the portfolio.
              </p>
            </>
          }
        />
      </PortalBody>
    </>
  );
}
