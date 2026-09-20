import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, savedItems } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { CATEGORY_LABEL } from "@/lib/catalogue";

export default async function AccountSavedPage() {
  const session = await requireUser();

  const rows = await db
    .select({
      id: savedItems.id,
      slug: products.slug,
      name: products.name,
      category: products.category,
    })
    .from(savedItems)
    .innerJoin(products, eq(savedItems.productId, products.id))
    .where(eq(savedItems.userId, session.user.id))
    .orderBy(desc(savedItems.createdAt));

  return (
    <>
      <PortalHeader title="Saved items" />

      <PortalBody>
        {rows.length === 0 ? (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <h2 className="font-display text-lg">Nothing saved yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              Save a product while you&rsquo;re browsing and it will wait for you
              here.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex rounded-[2px] bg-brand px-6 py-3 text-[13px] font-semibold text-on-accent"
            >
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col overflow-hidden rounded-md border border-line bg-white"
              >
                <ImagePlaceholder
                  caption={`[Photograph — ${row.name.toLowerCase()}]`}
                  className="aspect-[4/3] w-full"
                />
                <div className="flex flex-col gap-1.5 p-5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-accent-text">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                  <Link
                    href={`/products/${row.slug}`}
                    className="text-sm font-semibold hover:underline"
                  >
                    {row.name}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PortalBody>
    </>
  );
}
