import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productPrices, productSizes, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import {
  addProductSizeAction,
  retireProductSizeAction,
  updateProductAction,
} from "@/lib/admin/catalogue-actions";
import { resolveImageUrl } from "@/lib/storage/image-url";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill } from "@/components/portal/status-pill";
import { ProductForm, SizeForm } from "@/components/admin/catalogue-forms";

export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireAdmin();
  const { productId } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) notFound();

  const sizes = await db
    .select({
      id: productSizes.id,
      label: productSizes.label,
      widthMm: productSizes.widthMm,
      heightMm: productSizes.heightMm,
      isActive: productSizes.isActive,
      amountMinor: productPrices.amountMinor,
      currency: productPrices.currency,
    })
    .from(productSizes)
    .leftJoin(productPrices, eq(productPrices.productSizeId, productSizes.id))
    .where(eq(productSizes.productId, productId))
    .orderBy(asc(productSizes.sortOrder), asc(productSizes.label));

  const imageUrl = await resolveImageUrl(product.heroImageUrl);

  return (
    <>
      <PortalHeader
        title={product.name}
        actions={
          <div className="flex items-center gap-4">
            <Link
              href={`/products/${product.slug}`}
              className="text-[13px] font-semibold text-accent-text"
            >
              See it on the site
            </Link>
            <Link
              href="/admin/products"
              className="text-[13px] font-semibold text-accent-text"
            >
              ← Products
            </Link>
          </div>
        }
      />

      <PortalBody>
        <div className="grid gap-7 lg:grid-cols-[1.6fr_1fr]">
          <section className="rounded-md border border-line bg-white p-7">
            <ProductForm
              action={updateProductAction}
              submitLabel="Save the product"
              values={{
                id: product.id,
                name: product.name,
                category: product.category,
                summary: product.summary,
                description: product.description,
                minimumQuantity: product.minimumQuantity,
                sortOrder: product.sortOrder,
                isActive: product.isActive,
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
                <img
                  src={imageUrl}
                  alt={product.name}
                  className="block w-full"
                />
              ) : (
                <p className="px-6 py-8 text-center text-[13px] text-ink-muted">
                  No photograph yet.
                </p>
              )}
            </section>

            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-lg">Address on the site</h2>
              <p className="mt-2 break-all text-[13px] text-ink-muted">
                /products/{product.slug}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-quiet">
                This never changes when you rename the product, so any link you
                have already given out keeps working.
              </p>
            </section>
          </aside>

          <section className="overflow-hidden rounded-md border border-line bg-white lg:col-span-2">
            <div className="border-b border-line-soft px-6 py-4">
              <h2 className="font-display text-lg">
                Sizes it comes in ({sizes.length})
              </h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Prices are set per size under Pricing. A size with no price
                shows &ldquo;{QUOTED_INDIVIDUALLY.toLowerCase()}&rdquo; on the
                website.
              </p>
            </div>

            {sizes.length > 0 && (
              <ul>
                {sizes.map((size) => (
                  <li
                    key={size.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-semibold">
                        {size.label}
                      </span>
                      <span className="text-[12px] text-ink-quiet">
                        {size.widthMm && size.heightMm
                          ? `${size.widthMm} × ${size.heightMm}mm`
                          : "No dimensions recorded"}
                      </span>
                    </span>

                    <span className="flex items-center gap-4">
                      <span className="text-[13px] font-semibold">
                        {size.amountMinor === null
                          ? QUOTED_INDIVIDUALLY
                          : formatMoney(
                              size.amountMinor,
                              size.currency ?? "GBP",
                            )}
                      </span>

                      <form action={retireProductSizeAction}>
                        <input type="hidden" name="sizeId" value={size.id} />
                        <input
                          type="hidden"
                          name="productId"
                          value={product.id}
                        />
                        <input
                          type="hidden"
                          name="restore"
                          value={String(!size.isActive)}
                        />
                        <button
                          type="submit"
                          aria-label={
                            size.isActive
                              ? `Retire the ${size.label} size`
                              : `Offer the ${size.label} size again`
                          }
                        >
                          <StatusPill tone={size.isActive ? "good" : "neutral"}>
                            {size.isActive ? "Offered" : "Retired"}
                          </StatusPill>
                        </button>
                      </form>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="px-6 py-5">
              <SizeForm productId={product.id} action={addProductSizeAction} />
            </div>
          </section>
        </div>
      </PortalBody>
    </>
  );
}
