import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  isCategory,
  type Category,
} from "@/lib/catalogue";
import { Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { DiscoverButton } from "@/components/ui/discover-button";
import { PortfolioFilters } from "@/components/site/portfolio-filters";
import {
  countPopular,
  loadStyles,
  loadTemplateNumbers,
} from "@/lib/portfolio-filters";
import { resolveImageUrls } from "@/lib/storage/image-url";

export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "Recent funeral and wedding stationery from the Memories in Prints studio.",
};

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (name: string) => {
    const value = params[name];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };


  const active: Category | undefined = isCategory(one("category") || undefined)
    ? (one("category") as Category)
    : undefined;
  const query = one("q");

  // What can be filtered by is decided by the data, not by this file.
  const [styles, templateNumbers, popularCount] = await Promise.all([
    loadStyles(active),
    loadTemplateNumbers(active),
    countPopular(active),
  ]);

  // Only values the data actually holds are honoured, so a style or template
  // typed into the address bar can never reach the query.
  const style = styles.some((option) => option.value === one("style"))
    ? one("style")
    : "";

  const offered = new Set(templateNumbers.map((item) => item.number));
  const template = offered.has(Number(one("template")))
    ? Number(one("template"))
    : null;

  const popular = one("popular") === "1";

  const items = await db
    .select({
      id: portfolioItems.id,
      slug: portfolioItems.slug,
      title: portfolioItems.title,
      category: portfolioItems.category,
      description: portfolioItems.description,
      imageUrl: portfolioItems.imageUrl,
      templateNumber: portfolioItems.templateNumber,
    })
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.isPublished, true),
        active ? eq(portfolioItems.category, active) : undefined,
        query
          ? or(
              ilike(portfolioItems.title, `%${query}%`),
              ilike(portfolioItems.description, `%${query}%`),
            )
          : undefined,
        style ? eq(portfolioItems.style, style) : undefined,
        template === null
          ? undefined
          : eq(portfolioItems.templateNumber, template),
        popular ? eq(portfolioItems.isPopular, true) : undefined,
      ),
    )
    .orderBy(asc(portfolioItems.sortOrder));

  const images = await resolveImageUrls(items.map((item) => item.imageUrl));

  // The search term rides along with a category change, so switching filters
  // never silently drops what someone typed.
  const filterHref = (value?: Category) => {
    const next = new URLSearchParams();
    if (value) next.set("category", value);
    if (query) next.set("q", query);
    // Attribute choices are dropped when the category changes: the keys on
    // offer differ per category, and carrying "theme=Coastal" into Funeral
    // would land on an empty grid with no obvious way back.
    const search = next.toString();
    return search ? `/portfolio?${search}` : "/portfolio";
  };

  const resetHref = filterHref(active);
  const isFiltered = Boolean(style) || template !== null || popular;

  const filters = [
    { id: "all", label: "All work", href: filterHref() },
    ...CATEGORIES.map((value) => ({
      id: value,
      label: CATEGORY_LABEL[value],
      href: filterHref(value),
    })),
  ];

  return (
    <>
      <Section>
        <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">
            {query ? `Portfolio results for “${query}”` : "Portfolio"}
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Every piece is designed to order and proofed with the client before
            it goes to print. Browse recent funeral and wedding stationery
            below, or filter by category.
          </p>
        </div>

        <DiscoverButton
          groups={filters}
          activeId={active ?? "all"}
          searchAction="/portfolio"
          searchPlaceholder="Search the portfolio…"
          searchLabel="Search the portfolio"
          tabsLabel="Filter by category"
          className="mb-10"
        />

        <PortfolioFilters
          styles={styles}
          templateNumbers={templateNumbers}
          popularCount={popularCount}
          style={style}
          template={template}
          popular={popular}
          base={{ category: active, q: query || undefined }}
          resetHref={resetHref}
          matchCount={items.length}
        />

        {items.length === 0 ? (
          <p className="rounded-md border border-line bg-card p-10 text-center text-[15px] text-ink-muted">
            {isFiltered
              ? "No piece matches every filter at once. Loosen one of them, or "
              : query
                ? `Nothing in the portfolio matched “${query}”. Try a broader word, another category, or `
                : "Nothing here yet in this category. Try another, or "}
            <Link href="/quote" className="font-semibold text-accent-text">
              tell us what you have in mind
            </Link>
            .
          </p>
        ) : (
          <ul
            aria-label="Portfolio pieces"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((item, index) => (
              <li key={item.id}>
                <Link
                  href={`/portfolio/${item.slug}`}
                  className="group flex h-full flex-col gap-3"
                >
                  {/*
                    1142/1600 is the studio's own template, not a design
                    choice. These are A5-proportioned printed pages, and
                    object-cover crops to fill: in a 4:3 frame it took a
                    quarter off the top of every piece, which is exactly where
                    the heading, the name and the dates sit. The frame matches
                    the paper.
                  */}
                  <ImagePlaceholder
                    caption={`[Photograph — ${item.title.toLowerCase()}]`}
                    src={images[index]}
                    className="aspect-[1142/1600] w-full rounded-md"
                  />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                    {CATEGORY_LABEL[item.category]}
                  </span>
                  <h2 className="font-display text-lg group-hover:text-blue">
                    {item.title}
                  </h2>
                  {item.templateNumber !== null && (
                    <p className="text-[12px] text-ink-quiet">
                      Template no. {item.templateNumber}
                    </p>
                  )}
                  {item.description && (
                    <p className="text-[14px] leading-relaxed text-ink-muted">
                      {item.description}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
