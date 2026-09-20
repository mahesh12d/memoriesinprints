import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { productSizes, products } from "@/db/schema";
import {
  CATEGORIES,
  CATEGORY_BLURB,
  CATEGORY_LABEL,
  isCategory,
  type Category,
} from "@/lib/catalogue";
import { Breadcrumb, CtaBand, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { SaveButton } from "@/components/site/save-button";
import { resolveImageUrls } from "@/lib/storage/image-url";
import { loadSavedProductIds } from "@/lib/saved/queries";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Funeral, wedding and celebration stationery, printed and finished by hand.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active: Category | undefined = isCategory(category)
    ? category
    : undefined;

  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      summary: products.summary,
      category: products.category,
      minimumQuantity: products.minimumQuantity,
      heroImageUrl: products.heroImageUrl,
    })
    .from(products)
    .where(
      active
        ? and(eq(products.isActive, true), eq(products.category, active))
        : eq(products.isActive, true),
    )
    .orderBy(asc(products.sortOrder));

  const images = await resolveImageUrls(rows.map((row) => row.heroImageUrl));
  const saved = await loadSavedProductIds();
  const listPath = active ? `/products?category=${active}` : "/products";

  // One query for every size, rather than one per product.
  const sizes = rows.length
    ? await db
        .select({
          productId: productSizes.productId,
          label: productSizes.label,
        })
        .from(productSizes)
        .where(
          and(
            inArray(
              productSizes.productId,
              rows.map((row) => row.id),
            ),
            eq(productSizes.isActive, true),
          ),
        )
        .orderBy(asc(productSizes.sortOrder))
    : [];

  const sizesByProduct = new Map<string, string[]>();
  for (const size of sizes) {
    const list = sizesByProduct.get(size.productId) ?? [];
    list.push(size.label);
    sizesByProduct.set(size.productId, list);
  }

  const heading = active
    ? `${CATEGORY_LABEL[active]} stationery`
    : "Our stationery";

  const blurb = active
    ? CATEGORY_BLURB[active]
    : "Everything the studio prints, across funerals, weddings and the occasions in between. Each piece is proofed with you before anything goes to press.";

  return (
    <>
      <Section>
        <Breadcrumb
          trail={[
            { href: "/", label: "Home" },
            ...(active
              ? [
                  { href: "/products", label: "Products" },
                  { label: CATEGORY_LABEL[active] },
                ]
              : [{ label: "Products" }]),
          ]}
        />

        <div className="mb-10 flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">{heading}</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">{blurb}</p>
        </div>

        <nav aria-label="Filter by category" className="mb-10">
          <ul className="flex flex-wrap gap-2.5">
            <li>
              <Link
                href="/products"
                aria-current={!active ? "true" : undefined}
                className={`inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold ${
                  !active
                    ? "bg-blue text-white"
                    : "border border-line bg-white text-ink-soft hover:border-brand"
                }`}
              >
                Everything
              </Link>
            </li>
            {CATEGORIES.map((value) => (
              <li key={value}>
                <Link
                  href={`/products?category=${value}`}
                  aria-current={active === value ? "true" : undefined}
                  className={`inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold ${
                    active === value
                      ? "bg-blue text-white"
                      : "border border-line bg-white text-ink-soft hover:border-brand"
                  }`}
                >
                  {CATEGORY_LABEL[value]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((product, index) => (
            <li
              key={product.id}
              className="relative flex flex-col overflow-hidden rounded-md border border-line bg-white"
            >
              <SaveButton
                productId={product.id}
                productName={product.name}
                isSaved={saved.has(product.id)}
                returnTo={listPath}
              />
              <ImagePlaceholder
                caption={`[Photograph — ${product.name.toLowerCase()}]`}
                src={images[index]}
                className="aspect-[4/3] w-full"
              />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                  {CATEGORY_LABEL[product.category]}
                </span>
                <h2 className="font-display text-lg">{product.name}</h2>
                {product.summary && (
                  <p className="text-[14px] leading-relaxed text-ink-muted">
                    {product.summary}
                  </p>
                )}
                <p className="text-[12px] text-ink-quiet">
                  {(sizesByProduct.get(product.id) ?? []).join(" · ") ||
                    "Sizes confirmed at quote"}
                </p>
                <Link
                  href={`/products/${product.slug}`}
                  className="mt-auto pt-2 text-[13px] font-semibold text-accent-text"
                >
                  View details →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Not sure what you need?"
        body="Tell us about the service and we'll recommend the right pieces — no pressure, and nothing prints until you approve it."
        primary={{ href: "/quote", label: "Request a custom quote" }}
      />
    </>
  );
}
