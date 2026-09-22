import Link from "next/link";

/**
 * Looks up an order from the portal.
 *
 * A plain GET form: the term lands in the URL beside the status filters, so a
 * search can be bookmarked or sent to a colleague, the back button behaves,
 * and none of it depends on JavaScript having arrived.
 */
export function OrderSearch({
  basePath,
  query,
  placeholder,
  /** Filters already in the URL, carried through so a search doesn't drop them. */
  keep,
}: {
  basePath: string;
  query: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
}) {
  const carried = Object.entries(keep ?? {}).filter(([, value]) => value);

  const clearHref = carried.length
    ? `${basePath}?${new URLSearchParams(carried as [string, string][])}`
    : basePath;

  return (
    <form action={basePath} className="flex items-center gap-2">
      {carried.map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 text-ink-quiet"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>

        <label htmlFor="order-search" className="sr-only">
          {placeholder}
        </label>
        <input
          id="order-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder={placeholder}
          className="w-[22ch] border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-placeholder"
        />
      </div>

      <button
        type="submit"
        className="h-10 rounded-full bg-band px-4 text-[13px] font-semibold text-white hover:bg-band-deep"
      >
        Search
      </button>

      {query && (
        <Link
          href={clearHref}
          className="text-[13px] font-semibold text-accent-text"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
