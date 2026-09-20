import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { productPrices, productSizes, products } from "@/db/schema";
import { CATEGORY_LABEL } from "@/lib/catalogue";
import { ProductPurchase, type SizeOption } from "./product-purchase";
import { TURNAROUND_NOTE } from "@/lib/studio";
import { Breadcrumb, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { SaveButton } from "@/components/site/save-button";
import { resolveImageUrl } from "@/lib/storage/image-url";
import { loadSavedProductIds } from "@/lib/saved/queries";

async function loadProduct(slug: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.isActive, true)))
    .limit(1);

  return product ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.summary ?? undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await loadProduct(slug);

  if (!product) notFound();

  const heroImage = await resolveImageUrl(product.heroImageUrl);
  const saved = await loadSavedProductIds();

  const [sizes, prices, related] = await Promise.all([
    db
      .select({
        id: productSizes.id,
        label: productSizes.label,
        widthMm: productSizes.widthMm,
        heightMm: productSizes.heightMm,
      })
      .from(productSizes)
      .where(
        and(
          eq(productSizes.productId, product.id),
          eq(productSizes.isActive, true),
        ),
      )
      .orderBy(asc(productSizes.sortOrder)),
    // Public list prices only — a signed-in visitor's own rate is fetched
    // after render, so this page stays cacheable and auth-free.
    db
      .select({
        productSizeId: productPrices.productSizeId,
        amountMinor: productPrices.amountMinor,
        currency: productPrices.currency,
      })
      .from(productPrices)
      .where(
        and(
          eq(productPrices.productId, product.id),
          eq(productPrices.isActive, true),
        ),
      ),
    db
      .select({ slug: products.slug, name: products.name })
      .from(products)
      .where(
        and(
          eq(products.category, product.category),
          eq(products.isActive, true),
          ne(products.id, product.id),
        ),
      )
      .orderBy(asc(products.sortOrder))
      .limit(3),
  ]);

  const priceBySize = new Map(
    prices.map((row) => [
      row.productSizeId,
      { amountMinor: row.amountMinor, currency: row.currency },
    ]),
  );

  const sizeOptions: SizeOption[] = sizes.map((size) => ({
    id: size.id,
    label: size.label,
    dimensions:
      size.widthMm && size.heightMm
        ? `${size.widthMm} × ${size.heightMm}mm`
        : null,
    basePrice: priceBySize.get(size.id) ?? null,
  }));

  return (
    <Section>
      <Breadcrumb
        trail={[
          { href: "/", label: "Home" },
          { href: "/products", label: "Products" },
          {
            href: `/products?category=${product.category}`,
            label: CATEGORY_LABEL[product.category],
          },
          { label: product.name },
        ]}
      />

      <div className="grid gap-12 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ImagePlaceholder
            caption={`[Photograph — ${product.name.toLowerCase()}, styled on a linen background]`}
            src={heroImage}
            className="aspect-[4/3] w-full rounded-md"
          />
          <div className="grid grid-cols-3 gap-4">
            {["detail", "reverse", "in the hand"].map((angle) => (
              <ImagePlaceholder
                key={angle}
                caption={`[Photograph — ${angle}]`}
                className="aspect-square w-full rounded"
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
              {CATEGORY_LABEL[product.category]} stationery
            </span>
            <h1 className="text-[34px] leading-tight">{product.name}</h1>
          </div>

          {(product.description ?? product.summary) && (
            <p className="text-[15px] leading-relaxed text-ink-soft">
              {product.description ?? product.summary}
            </p>
          )}

          <ProductPurchase
            slug={product.slug}
            sizes={sizeOptions}
            minimumQuantity={product.minimumQuantity}
          />

          <SaveButton
            variant="inline"
            productId={product.id}
            productName={product.name}
            isSaved={saved.has(product.id)}
            returnTo={`/products/${product.slug}`}
          />

          <div className="rounded-md border border-line bg-white p-6">
            <h2 className="font-display text-lg">Before anything is printed</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              A proof comes to you for approval first, whichever way you order.
              Need something bespoke, or a quantity outside the usual range?{" "}
              <Link
                href={`/quote?product=${product.slug}`}
                className="font-semibold text-accent-text"
              >
                Ask us for a quote
              </Link>
              .
            </p>
            <p className="mt-4 text-[12px] text-ink-quiet">{TURNAROUND_NOTE}</p>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-20">
          <h2 className="mb-8 text-[24px]">You may also need</h2>
          <ul className="grid gap-6 sm:grid-cols-3">
            {related.map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/products/${item.slug}`}
                  className="group flex flex-col gap-3"
                >
                  <ImagePlaceholder
                    caption={`[Photograph — ${item.name.toLowerCase()}]`}
                    className="aspect-[4/3] w-full rounded-md"
                  />
                  <span className="font-display text-lg group-hover:underline">
                    {item.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
