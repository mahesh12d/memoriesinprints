import Link from "next/link";

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

/**
 * Status filters that live in the URL rather than in component state, so a
 * filtered view can be bookmarked, shared with a colleague, or reloaded after
 * an edit without snapping back to "everything".
 */
export function FilterTabs({
  basePath,
  label,
  param = "status",
  current,
  options,
  extraParams,
  alwaysSetParam = false,
}: {
  basePath: string;
  /**
   * What this row of pills filters on.
   *
   * Two unlabelled rows of pills one above the other say nothing about which
   * is which — "Paid" and "Delivered" look like the same kind of answer to
   * the same unasked question.
   */
  label?: string;
  param?: string;
  current: string;
  options: FilterOption[];
  /** Other query parameters to preserve while switching this one. */
  extraParams?: Record<string, string | undefined>;
  /**
   * Normally "all" is the bare URL with no parameter. Where there is no "all"
   * option — the customer's orders, which are always in exactly one group —
   * the bare URL means "whichever group has something in it", so the chosen
   * one has to be written out or the tabs would not hold.
   */
  alwaysSetParam?: boolean;
}) {
  function hrefFor(value: string): string {
    const params = new URLSearchParams();

    for (const [key, item] of Object.entries(extraParams ?? {})) {
      if (item) params.set(key, item);
    }

    if (alwaysSetParam || value !== "all") params.set(param, value);

    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const pills = (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === current;

        return (
          <Link
            key={option.value}
            href={hrefFor(option.value)}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              active
                ? "bg-band text-white"
                : "border border-line text-ink-muted hover:bg-surface-grey"
            }`}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={active ? "text-white/70" : "text-ink-quiet"}>
                {" "}
                {option.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );

  if (!label) return pills;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-quiet">
        {label}
      </span>
      {pills}
    </div>
  );
}
