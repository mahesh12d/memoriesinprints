import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { pricingBase, productSizes, products } from "@/db/schema";
import { CATEGORY_LABEL, formatPrice } from "@/lib/catalogue";
import { TURNAROUND_NOTE } from "@/lib/studio";
import { Breadcrumb, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";

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

  const [sizes, basePrice, related] = await Promise.all([
    db
      .select({ id: productSizes.id, label: productSizes.label, widthMm: productSizes.widthMm, heightMm: productSizes.heightMm })
      .from(productSizes)
      .where(
        and(
          eq(productSizes.productId, product.id),
          eq(productSizes.isActive, true),
        ),
      )
      .orderBy(asc(productSizes.sortOrder)),
    db
      .select({ unitPricePence: pricingBase.unitPricePence })
      .from(pricingBase)
      .where(
        and(
          eq(pricingBase.productId, product.id),
          eq(pricingBase.isActive, true),
        ),
      )
      .limit(1),
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

  const from = basePrice[0]?.unitPricePence;

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
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warm">
              {CATEGORY_LABEL[product.category]} stationery
            </span>
            <h1 className="text-[34px] leading-tight">{product.name}</h1>
            <p className="text-[15px] text-ink-muted">
              {from
                ? `From ${formatPrice(from)} per piece · price confirmed at quote`
                : "Price confirmed at quote"}
            </p>
          </div>

          {(product.description ?? product.summary) && (
            <p className="text-[15px] leading-relaxed text-ink-soft">
              {product.description ?? product.summary}
            </p>
          )}

          {sizes.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-[13px] font-semibold text-ink-soft">
                Available sizes
              </h2>
              <ul className="flex flex-wrap gap-2.5">
                {sizes.map((size) => (
                  <li
                    key={size.id}
                    className="rounded-full border border-line bg-white px-4 py-2 text-[13px] text-ink-soft"
                  >
                    {size.label}
                    {size.widthMm && size.heightMm && (
                      <span className="text-ink-faint">
                        {" "}
                        ({size.widthMm} × {size.heightMm}mm)
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-line bg-white p-6">
            <h2 className="font-display text-lg">Order this piece</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              Tell us the quantity and the date you need it by, and we&rsquo;ll
              send a written quote within one working day. Nothing is charged
              until you&rsquo;ve approved it.
            </p>
            <Link
              href={`/quote?product=${product.slug}`}
              className="mt-5 inline-flex rounded-[2px] bg-charcoal px-7 py-3.5 text-sm font-semibold text-ivory hover:bg-night"
            >
              Request a quote for this
            </Link>
            <p className="mt-4 text-[12px] text-ink-faint">
              Minimum order {product.minimumQuantity}. {TURNAROUND_NOTE}
            </p>
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
