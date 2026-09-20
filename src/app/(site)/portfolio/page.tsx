import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  isCategory,
  type Category,
} from "@/lib/catalogue";
import { CtaBand, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { resolveImageUrls } from "@/lib/storage/image-url";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Recent funeral and wedding stationery from the Memories in Prints studio.",
};

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const active: Category | undefined = isCategory(category)
    ? category
    : undefined;

  const items = await db
    .select({
      id: portfolioItems.id,
      title: portfolioItems.title,
      category: portfolioItems.category,
      description: portfolioItems.description,
      imageUrl: portfolioItems.imageUrl,
    })
    .from(portfolioItems)
    .where(
      active
        ? and(
            eq(portfolioItems.isPublished, true),
            eq(portfolioItems.category, active),
          )
        : eq(portfolioItems.isPublished, true),
    )
    .orderBy(asc(portfolioItems.sortOrder));

  const images = await resolveImageUrls(items.map((item) => item.imageUrl));

  const filters = [
    { href: "/portfolio", label: "All work", isActive: !active },
    ...CATEGORIES.map((value) => ({
      href: `/portfolio?category=${value}`,
      label: CATEGORY_LABEL[value],
      isActive: active === value,
    })),
  ];

  return (
    <>
      <Section>
        <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">Our work</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Every piece is designed to order and proofed with the client before
            it goes to print. Browse recent funeral and wedding stationery
            below, or filter by category.
          </p>
        </div>

        <nav aria-label="Filter by category" className="mb-10">
          <ul className="flex flex-wrap gap-2.5">
            {filters.map((filter) => (
              <li key={filter.href}>
                <Link
                  href={filter.href}
                  aria-current={filter.isActive ? "true" : undefined}
                  className={`inline-flex rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors ${
                    filter.isActive
                      ? "bg-blue text-white"
                      : "border border-line bg-white text-ink-soft hover:border-brand"
                  }`}
                >
                  {filter.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {items.length === 0 ? (
          <p className="rounded-md border border-line bg-white p-10 text-center text-[15px] text-ink-muted">
            Nothing here yet in this category. Try another, or{" "}
            <Link href="/quote" className="font-semibold text-accent-text">
              tell us what you have in mind
            </Link>
            .
          </p>
        ) : (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-col gap-3">
                <ImagePlaceholder
                  caption={`[Photograph — ${item.title.toLowerCase()}]`}
                  src={images[index]}
                  className="aspect-[4/3] w-full rounded-md"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                  {CATEGORY_LABEL[item.category]}
                </span>
                <h2 className="font-display text-lg">{item.title}</h2>
                {item.description && (
                  <p className="text-[14px] leading-relaxed text-ink-muted">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <CtaBand
        title="Don't see what you need?"
        body="Every project we take on starts as a conversation. Tell us what you're planning and we'll get back to you within one working day."
        primary={{ href: "/quote", label: "Request a custom quote" }}
      />
    </>
  );
}
