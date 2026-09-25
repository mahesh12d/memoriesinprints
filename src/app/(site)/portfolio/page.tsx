import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import {
  CATEGORY_LABEL,
  isCategory,
  type Category,
} from "@/lib/catalogue";
import { CtaBand, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { DiscoverButton } from "@/components/ui/discover-button";
import { PortfolioFilters } from "@/components/site/portfolio-filters";
import {
  countPopular,
  loadFacets,
  loadStyles,
  loadTemplateNumbers,
} from "@/lib/portfolio-filters";
import { resolveImageUrls } from "@/lib/storage/image-url";

/**
 * The colour names the catalogue uses, as the colours they mean.
 *
 * Muted on purpose — these sit under a photograph of somebody's order of
 * service, and a saturated swatch beside it would be the loudest thing on the
 * page. A name with no entry here simply gets no accent.
 */
const SWATCH: Record<string, string> = {
  Blue: "#4f7fa8",
  Brown: "#7a5a44",
  Burgundy: "#7d2c3d",
  Cream: "#e0d3b8",
  Gold: "#b8923f",
  Green: "#4f7d5a",
  Grey: "#8b9196",
  Natural: "#c2a98a",
  Pink: "#c98ba1",
  Purple: "#6f5a8e",
  White: "#d5d9da",
};

export const metadata: Metadata = {
  title: "Designs",
  description:
    "Funeral stationery designs from the Memories in Prints studio.",
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
  const [styles, templateNumbers, popularCount, facets] = await Promise.all([
    loadStyles(active),
    loadTemplateNumbers(active),
    countPopular(active),
    loadFacets(active),
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

  /**
   * Colour, religion and the rest, taken from the piece's own filters.
   *
   * Only values the data holds are honoured, exactly as with style above: the
   * chosen value goes into a SQL containment test, so a word typed into the
   * address bar must be one the facet query already returned.
   */
  const chosen: Record<string, string> = {};
  for (const facet of facets) {
    const picked = one(facet.key);
    if (facet.options.some((option) => option.value === picked)) {
      chosen[facet.key] = picked;
    }
  }

  const items = await db
    .select({
      id: portfolioItems.id,
      slug: portfolioItems.slug,
      title: portfolioItems.title,
      category: portfolioItems.category,
      // Not selected: the grid shows titles only. Search still matches on
      // the column itself, in the where clause below.
      imageUrl: portfolioItems.imageUrl,
      templateNumber: portfolioItems.templateNumber,
      isPopular: portfolioItems.isPopular,
      style: portfolioItems.style,
      filters: portfolioItems.filters,
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
        // `@>` rather than `?`: containment reads the same for one value as
        // for several, and keeps the value a bound parameter.
        ...Object.entries(chosen).map(
          ([key, value]) =>
            sql`${portfolioItems.filters} @> ${JSON.stringify({ [key]: [value] })}::jsonb`,
        ),
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
  const isFiltered =
    Boolean(style) ||
    template !== null ||
    popular ||
    Object.keys(chosen).length > 0;

  /**
   * The two halves of what the studio sells.
   *
   * Service sheets are the design templates on this page; other products —
   * the memorial cards, boxes and prints — have their own page with their own
   * sizes and prices, so the second tab goes there rather than rebuilding
   * that grid here.
   */
  const filters = [
    { id: "service-sheets", label: "Service Sheets", href: resetHref },
    { id: "other-products", label: "Other Products", href: "/products" },
  ];

  return (
    <>
      <Section>
        <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">
            {query ? `Designs matching “${query}”` : "Funeral Stationery"}
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Every piece is designed to order and proofed with the client
            before it goes to print. Explore our designs &amp; stationery below,
            or browse by styles.
          </p>
        </div>

        <DiscoverButton
          groups={filters}
          activeId="service-sheets"
          showSearch={false}
          tabsLabel="Service sheets or other products"
          className="mb-10"
        />

        <PortfolioFilters
          styles={styles}
          templateNumbers={templateNumbers}
          popularCount={popularCount}
          style={style}
          template={template}
          popular={popular}
          facets={facets}
          chosen={chosen}
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
            /*
              Four across from xl. The frame is portrait — it has to be, or the
              name is cropped off the top — so three across made each card
              500px tall and pushed the titles below the fold. Narrower cards
              are shorter ones, and a portfolio is for scanning.
            */
            className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {items.map((item, index) => {
              /*
                The piece's own colour, as a hairline along the foot of the
                card.

                A hundred portrait covers at the same size in the same frame
                read as wallpaper — you scroll past them rather than look at
                them. This is the one thing each piece already carries that
                differs from its neighbours, so a Gold tribute and a Blue one
                are told apart before either title is read. It is a 3px line,
                not a tint: on a page about somebody's funeral, colour-coding
                that shouts would be the wrong thing entirely.
              */
              const accent = SWATCH[item.filters.colour?.[0] ?? ""] ?? null;

              return (
                <li key={item.id} className="group">
                  <Link
                    href={`/portfolio/${item.slug}`}
                    className="portfolio-card flex h-full flex-col overflow-hidden rounded-md border border-line bg-card transition duration-300 hover:-translate-y-1 hover:border-brand-line hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    {/*
                      1142/1600 is the studio's own template, not a design
                      choice. These are A5-proportioned printed pages, and
                      object-cover crops to fill: in a 4:3 frame it took a
                      quarter off the top of every piece, which is exactly where
                      the heading, the name and the dates sit. The frame matches
                      the paper.
                    */}
                    <div className="relative overflow-hidden">
                      <ImagePlaceholder
                        caption={`[Photograph — ${item.title.toLowerCase()}]`}
                        src={images[index]}
                        className="aspect-[1142/1600] w-full transition-transform duration-500 ease-out group-hover:scale-105"
                      />

                      {/*
                        The invitation to click, which only appears when the
                        cursor is already there. Hidden from screen readers:
                        the link around it already says where it goes, and a
                        second "view this piece" on every card is a hundred
                        of them to listen past.
                      */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-black/55 to-transparent pb-3 pt-10 text-[12px] font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                      >
                        View this piece →
                      </span>

                      {/*
                        The studio's own mark, on the artwork rather than under
                        it. Below the image it would be a fourth line of text
                        competing with the title; over the corner it reads as a
                        label on the piece, which is what it is.
                      */}
                      {item.isPopular && (
                        <span className="absolute left-3 top-3 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
                          Popular
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5 p-4">
                      <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                        {CATEGORY_LABEL[item.category]}
                        {item.style && (
                          <span className="font-medium normal-case tracking-normal text-ink-quiet">
                            {item.style}
                          </span>
                        )}
                      </span>

                      <h2 className="font-display text-lg leading-snug transition-colors group-hover:text-blue">
                        {item.title}
                      </h2>

                      {item.templateNumber !== null && (
                        <p className="mt-auto pt-1 text-[12px] text-ink-quiet">
                          Template no. {item.templateNumber}
                        </p>
                      )}
                    </div>

                    {/*
                      Full width and 3px, so it reads as part of the card
                      rather than as decoration floating under it. Pieces with
                      no colour recorded get the ordinary hairline, not a gap.
                    */}
                    <span
                      aria-hidden="true"
                      className="h-[3px] w-full bg-line-soft transition-[background-color] duration-300"
                      style={accent ? { backgroundColor: accent } : undefined}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <CtaBand
        title="Haven't Found What You're Looking For Yet?"
        body="Please don't hesitate to reach out. Most of what leaves this studio started as a conversation about something that wasn't in the catalogue."
        primary={{ href: "/contact", label: "Contact Us" }}
      />
    </>
  );
}
