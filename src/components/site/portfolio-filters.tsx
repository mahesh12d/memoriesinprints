import Link from "next/link";
import type { FilterOption } from "@/lib/portfolio-filters";
import { TemplatePicker } from "./template-picker";

/**
 * The portfolio's filter row: style, template number, popular.
 *
 * State rides on `aria-current` rather than extra hidden text. A control's
 * name should stay the same whether or not it is chosen — appending "selected,
 * choose again to clear" makes the name change under a screen reader every
 * time it is pressed, which is exactly what `aria-current` exists to avoid.
 *
 * Each filter holds one choice at a time. Picking a second style replaces the
 * first rather than adding to it, and picking the one already chosen clears
 * it, so a chip is both the way in and the way out.
 *
 * Every filter is a link, which means no Apply step, a URL that can be shared
 * or bookmarked, a back button that steps back through the choices, keyboard
 * operation for free, and none of it depending on JavaScript arriving.
 */
export function PortfolioFilters({
  styles,
  templateNumbers,
  popularCount,
  facets,
  chosen,
  style,
  template,
  popular,
  base,
  resetHref,
  matchCount,
}: {
  styles: FilterOption[];
  templateNumbers: { number: number; count: number }[];
  popularCount: number;
  /** Colour, religion and anything else the pieces are filed under. */
  facets: { key: string; options: FilterOption[] }[];
  /** The value picked in each of those, where one has been. */
  chosen: Record<string, string>;
  style: string;
  template: number | null;
  popular: boolean;
  /** Category and search, kept on every filter link. */
  base: Record<string, string | undefined>;
  resetHref: string;
  matchCount: number;
}) {
  if (
    styles.length === 0 &&
    templateNumbers.length === 0 &&
    popularCount === 0 &&
    facets.length === 0
  ) {
    return null;
  }

  const isFiltered =
    Boolean(style) ||
    template !== null ||
    popular ||
    Object.keys(chosen).length > 0;

  /**
   * The current URL with one filter set, or cleared when it already holds
   * that value. The other two filters are carried through untouched.
   */
  function hrefWith(changed: Partial<Record<string, string | null>>): string {
    const next = new URLSearchParams();

    for (const [key, value] of Object.entries(base)) {
      if (value) next.set(key, value);
    }

    const current: Record<string, string> = {
      style,
      template: template === null ? "" : String(template),
      popular: popular ? "1" : "",
      ...chosen,
    };

    for (const [key, value] of Object.entries({ ...current, ...changed })) {
      if (value) next.set(key, value);
    }

    const search = next.toString();
    return search ? `/portfolio?${search}` : "/portfolio";
  }

  return (
    <section
      aria-label="Refine this collection"
      className="mb-8 flex flex-col gap-5 border-y border-line py-5"
    >
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h2 className="font-display text-xl">Refine this collection</h2>
        <p className="text-[13px] text-ink-quiet">
          {matchCount} {matchCount === 1 ? "piece" : "pieces"}
        </p>
        {isFiltered && (
          <Link
            href={resetHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-field-line px-4 py-2 text-[13px] font-semibold text-ink-soft hover:border-brand hover:text-blue"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Clear filters
          </Link>
        )}
      </div>

      {/*
        The two filter groups share a row from lg up.

        Stacked, they pushed the first portfolio card to y=722 on a 900px
        screen — the grid itself started below the fold, so the page opened on
        controls rather than on the work. Side by side they cost one row.
      */}
      <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-10">
      {styles.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-semibold text-ink-soft">
            Filter by style
          </h3>

          {/* Wraps rather than clipping: a label nobody can read is one nobody can choose. */}
          <ul className="flex flex-wrap gap-2.5">
            {styles.map((option) => {
              const active = option.value === style;

              return (
                <li key={option.value}>
                  <Chip
                    href={hrefWith({ style: active ? null : option.value })}
                    active={active}
                  >
                    {option.value}
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/*
        One group per dimension the pieces are actually filed under. These
        came across with the catalogue — colour, religion, children — and are
        read from the data rather than listed here, so a new one needs no
        code.
      */}
      {facets.map((facet) => (
        <div key={facet.key} className="flex flex-col gap-2.5">
          <h3 className="text-[13px] font-semibold text-ink-soft">
            {/* Only the key is capitalised — `capitalize` on the whole line
                turned this into "Filter By Colour". */}
            Filter by <span className="capitalize">{facet.key}</span>
          </h3>

          <ul className="flex flex-wrap gap-2.5">
            {facet.options.map((option) => {
              const active = chosen[facet.key] === option.value;

              return (
                <li key={option.value}>
                  <Chip
                    href={hrefWith({
                      [facet.key]: active ? null : option.value,
                    })}
                    active={active}
                  >
                    {option.value}
                  </Chip>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
        {templateNumbers.length > 0 && (
          <TemplatePicker
            selected={template}
            clearHref={hrefWith({ template: null })}
            items={templateNumbers.map((item) => ({
              ...item,
              // Built here so the client component never has to know the URL
              // shape, and so it stays serializable across the boundary.
              href: hrefWith({
                template:
                  item.number === template ? null : String(item.number),
              }),
            }))}
          />
        )}

        {popularCount > 0 && (
          <div className="flex flex-col gap-2.5">
            <h3 className="text-[13px] font-semibold text-ink-soft">
              Filter by popularity
            </h3>
            <Chip href={hrefWith({ popular: popular ? null : "1" })} active={popular}>
              Popular
            </Chip>
          </div>
        )}
      </div>
      </div>
    </section>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex rounded-full border px-5 py-2.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-brand bg-brand-tint text-blue"
          : "border-line bg-card text-ink-soft hover:border-brand hover:text-blue"
      }`}
    >
      {children}
    </Link>
  );
}
