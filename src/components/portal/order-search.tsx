"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Looks up an order from the portal.
 *
 * Still a plain GET form underneath: the term lands in the URL beside the
 * status filters, so a search can be bookmarked or sent to a colleague, the
 * back button behaves, and it works with no JavaScript at all.
 *
 * On top of that, when `liveTarget` names a list, typing filters the rows
 * already on the page immediately — no Enter, no round trip. The whole of
 * someone's order history is rendered here already, so asking the server again
 * would be slower and would tell it nothing it hasn't already sent.
 */
export function OrderSearch({
  basePath,
  query,
  placeholder,
  /** Filters already in the URL, carried through so a search doesn't drop them. */
  keep,
  /**
   * id of a list whose `[data-search]` children should be filtered as you
   * type. Omit it and the form behaves exactly as it did before.
   */
  liveTarget,
}: {
  basePath: string;
  query: string;
  placeholder: string;
  keep?: Record<string, string | undefined>;
  liveTarget?: string;
}) {
  const carried = Object.entries(keep ?? {}).filter(([, value]) => value);
  const [term, setTerm] = useState(query);
  const [hiddenAll, setHiddenAll] = useState(false);

  const clearHref = carried.length
    ? `${basePath}?${new URLSearchParams(carried as [string, string][])}`
    : basePath;

  /**
   * Hides the rows that don't match, and says how many are left.
   *
   * Run from the change handler rather than an effect: the filtering is a
   * response to typing, not state being synchronised, and setting state from
   * inside an effect makes React render twice for every keystroke.
   */
  function filterRows(value: string): number {
    if (!liveTarget) return -1;

    const list = document.getElementById(liveTarget);
    if (!list) return -1;

    const needle = value.trim().toLowerCase();
    const items = list.querySelectorAll<HTMLElement>("[data-search]");

    let shown = 0;
    for (const item of items) {
      const hit =
        !needle || (item.dataset.search ?? "").toLowerCase().includes(needle);

      // `hidden` rather than a class: it takes the row out of the
      // accessibility tree too, so a screen reader isn't read rows that
      // aren't there any more.
      item.hidden = !hit;
      if (hit) shown += 1;
    }

    return items.length === 0 ? -1 : shown;
  }

  /**
   * Rows are server-rendered and React doesn't own their `hidden`, so if this
   * component goes away the filtering has to be undone by hand or the list
   * would stay half-hidden behind it.
   */
  useEffect(() => {
    return () => {
      if (!liveTarget) return;
      const list = document.getElementById(liveTarget);
      list
        ?.querySelectorAll<HTMLElement>("[data-search]")
        .forEach((item) => (item.hidden = false));
    };
  }, [liveTarget]);

  return (
    <div className="flex flex-col gap-2">
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
            value={term}
            onChange={(event) => {
              const value = event.target.value;
              setTerm(value);
              setHiddenAll(filterRows(value) === 0);
            }}
            placeholder={placeholder}
            className="w-[22ch] border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-placeholder"
          />
        </div>

        {/*
          Kept for the no-JavaScript case and for anyone who presses it out of
          habit. With filtering already live it is not the way most searches
          will end, so it does not shout.
        */}
        <button
          type="submit"
          className="h-10 rounded-full bg-band px-4 text-[13px] font-semibold text-white hover:bg-band-deep"
        >
          Search
        </button>

        {(term || query) && (
          <Link
            href={clearHref}
            onClick={() => {
              setTerm("");
              filterRows("");
              setHiddenAll(false);
            }}
            className="text-[13px] font-semibold text-accent-text"
          >
            Clear
          </Link>
        )}
      </form>

      {hiddenAll && (
        <p className="text-[13px] text-ink-muted" role="status">
          Nothing here matches &ldquo;{term.trim()}&rdquo;. Press Search to look
          through every order, not just the ones on this page.
        </p>
      )}
    </div>
  );
}
