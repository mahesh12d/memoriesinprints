import Link from "next/link";

/**
 * Prev / next through a long list.
 *
 * Plain links rather than buttons: the page number lives in the URL, so a
 * page can be bookmarked, it survives a reload after an edit, and the back
 * button walks back through the pages rather than out of the list entirely.
 *
 * At either end the control becomes plain text instead of a link, so nobody
 * tabbing through lands on something that goes nowhere.
 */
export function Pagination({
  basePath,
  page,
  pageCount,
  params,
  labels = { previous: "← Newer", next: "Older →" },
}: {
  basePath: string;
  page: number;
  pageCount: number;
  /** Everything else in the URL — filters, search — carried across pages. */
  params?: Record<string, string | undefined>;
  labels?: { previous: string; next: string };
}) {
  if (pageCount <= 1) return null;

  function hrefFor(target: number): string {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) search.set(key, value);
    }

    // Page one is the bare URL, so the first page has one address rather
    // than two that render the same thing.
    if (target > 1) search.set("page", String(target));

    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const step = (target: number, label: string, disabled: boolean) =>
    disabled ? (
      <span className="text-[13px] text-ink-pale">{label}</span>
    ) : (
      <Link
        href={hrefFor(target)}
        className="text-[13px] font-semibold text-accent-text hover:underline"
      >
        {label}
      </Link>
    );

  return (
    <nav
      aria-label="Pages"
      className="flex items-center justify-between gap-4 pt-1"
    >
      {step(page - 1, labels.previous, page <= 1)}

      <span className="text-[13px] text-ink-muted">
        Page {page} of {pageCount}
      </span>

      {step(page + 1, labels.next, page >= pageCount)}
    </nav>
  );
}
