import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItemPrices, portfolioItems } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import {
  deletePortfolioItemAction,
  updatePortfolioItemAction,
} from "@/lib/admin/catalogue-actions";
import { resolveImageUrl } from "@/lib/storage/image-url";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { PortfolioForm } from "@/components/admin/catalogue-forms";

export default async function AdminPortfolioDetailPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  await requireAdmin();
  const { itemId } = await params;

  const [item] = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.id, itemId))
    .limit(1);

  if (!item) notFound();

  const [price] = await db
    .select({
      amountMinor: portfolioItemPrices.amountMinor,
      currency: portfolioItemPrices.currency,
    })
    .from(portfolioItemPrices)
    .where(eq(portfolioItemPrices.portfolioItemId, itemId))
    .limit(1);

  const imageUrl = await resolveImageUrl(item.imageUrl);

  return (
    <>
      <PortalHeader
        title={item.title}
        actions={
          <div className="flex items-center gap-4">
            <Link
              href="/portfolio"
              className="text-[13px] font-semibold text-accent-text"
            >
              See the portfolio
            </Link>
            <Link
              href="/admin/portfolio"
              className="text-[13px] font-semibold text-accent-text"
            >
              ← Portfolio
            </Link>
          </div>
        }
      />

      <PortalBody>
        <div className="grid gap-7 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-md border border-line bg-white p-7">
            <PortfolioForm
              action={updatePortfolioItemAction}
              submitLabel="Save the piece"
              values={{
                id: item.id,
                title: item.title,
                category: item.category,
                description: item.description,
                sortOrder: item.sortOrder,
                isPublished: item.isPublished,
              }}
            />
          </section>

          <aside className="flex h-fit flex-col gap-6">
            <section className="overflow-hidden rounded-md border border-line bg-white">
              <div className="border-b border-line-soft px-6 py-4">
                <h2 className="font-display text-lg">Current photograph</h2>
              </div>
              {imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrl} alt={item.title} className="block w-full" />
              ) : (
                <p className="px-6 py-8 text-center text-[13px] text-ink-muted">
                  No photograph yet.
                </p>
              )}
            </section>

            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-lg">Price</h2>
              <p className="mt-2 text-[15px] font-semibold">
                {price
                  ? formatMoney(price.amountMinor, price.currency)
                  : QUOTED_INDIVIDUALLY}
              </p>
              <Link
                href="/admin/pricing/portfolio"
                className="mt-3 inline-flex text-[13px] font-semibold text-accent-text"
              >
                Set it under Pricing →
              </Link>
            </section>

            <section className="rounded-md border border-alert/30 bg-white p-6">
              <h2 className="font-display text-lg">Remove this piece</h2>
              <p className="mb-4 mt-1 text-[13px] leading-relaxed text-ink-muted">
                This deletes it outright. If you only want it off the website,
                untick &ldquo;Show this in the portfolio&rdquo; instead.
              </p>
              <form action={deletePortfolioItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <button
                  type="submit"
                  className="rounded-[2px] border border-alert px-5 py-2.5 text-[13px] font-semibold text-alert hover:bg-alert-tint"
                >
                  Delete permanently
                </button>
              </form>
            </section>
          </aside>
        </div>
      </PortalBody>
    </>
  );
}
