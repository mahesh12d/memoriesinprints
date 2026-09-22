"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type TemplateOption = {
  number: number;
  count: number;
  /** Built on the server, so this component never has to know the URL shape. */
  href: string;
};

/**
 * Template numbers, behind a disclosure with a search box.
 *
 * There is one number per design and the studio has hundreds, so this is the
 * one filter that can't be a row of chips and the one that needs typing to
 * get through. The search narrows on any part of the number, so "01" finds
 * 101 and 201 — people remember fragments of a number, not its first digit.
 *
 * Only the narrowing is client-side. The disclosure is a native `details` and
 * every row is an ordinary link built on the server, so with no JavaScript
 * the full list still opens and still works; the box just sits there inert.
 */
export function TemplatePicker({
  items,
  selected,
  clearHref,
}: {
  items: TemplateOption[];
  selected: number | null;
  /** Where "Any template number" goes: this filter off, the others kept. */
  clearHref: string;
}) {
  const [query, setQuery] = useState("");
  const detailsRef = useRef<HTMLDetailsElement>(null);

  /**
   * A native `details` only closes when its own summary is clicked again, so
   * clicking away leaves the panel hanging open over the page. Closing it on
   * an outside press and on Escape is what every other menu does.
   *
   * The listener is on `pointerdown` rather than `click`, but only ever
   * closes for a target outside the panel — closing on an inside press would
   * unmount a row before its click could navigate.
   */
  useEffect(() => {
    function closeIfOutside(event: PointerEvent) {
      const details = detailsRef.current;
      if (!details?.open) return;
      if (event.target instanceof Node && details.contains(event.target)) return;

      details.open = false;
      setQuery("");
    }

    function closeOnEscape(event: KeyboardEvent) {
      const details = detailsRef.current;
      if (event.key !== "Escape" || !details?.open) return;

      details.open = false;
      setQuery("");
      // Escape should leave focus somewhere sensible, not nowhere.
      details.querySelector("summary")?.focus();
    }

    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const term = query.trim();
  const shown = term
    ? items.filter((item) => String(item.number).includes(term))
    : items;

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-[13px] font-semibold text-ink-soft">
        Filter by template number
      </h3>

      <details ref={detailsRef} className="group relative w-fit">
        <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-card px-5 py-2.5 text-[13px] font-medium text-ink-soft marker:content-none hover:border-brand">
          {selected === null ? "Any template number" : `Template no. ${selected}`}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="transition-transform group-open:rotate-180"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </summary>

        <div className="absolute left-0 top-full z-10 mt-2 w-[260px] rounded-md border border-line bg-card p-2 shadow-lg">
          <label htmlFor="template-search" className="sr-only">
            Search template numbers
          </label>
          <input
            id="template-search"
            type="search"
            inputMode="numeric"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search template no."
            className="mb-2 w-full rounded-[3px] border border-field-line bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-placeholder focus-visible:border-brand"
          />

          {/* Typing changes the list silently otherwise, which tells a screen
              reader nothing about whether anything is left to choose. */}
          <p role="status" className="sr-only">
            {shown.length} template{" "}
            {shown.length === 1 ? "number" : "numbers"} listed
          </p>

          {shown.length === 0 ? (
            <p className="px-3 py-4 text-center text-[13px] text-ink-muted">
              No template number contains &ldquo;{term}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-[240px] overflow-y-auto">
              {selected !== null && !term && (
                <li>
                  <Link
                    href={clearHref}
                    className="flex rounded-[3px] px-3 py-2 text-[13px] font-semibold text-accent-text hover:bg-surface-grey"
                  >
                    Any template number
                  </Link>
                </li>
              )}
              {shown.map((item) => {
                const active = item.number === selected;

                return (
                  <li key={item.number}>
                    <Link
                      href={item.href}
                      aria-current={active ? "true" : undefined}
                      className={`flex items-center justify-between gap-3 rounded-[3px] px-3 py-2 text-[13px] hover:bg-surface-grey ${
                        active ? "font-semibold text-blue" : "text-ink-soft"
                      }`}
                    >
                      <span>{item.number}</span>
                      <span className="text-ink-quiet">{item.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </details>
    </div>
  );
}
