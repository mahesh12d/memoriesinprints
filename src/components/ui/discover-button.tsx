"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type DiscoverGroup = {
  id: string;
  label: string;
  /** A navigating tab — the filter URL. Pair with the `activeId` prop. */
  href?: string;
  /** A local tab — the shortcut chips shown while this tab is selected. */
  links?: { label: string; href: string }[];
};

/**
 * The compact discover bar: a search pill that expands in place, a segmented
 * tab pill beside it, and the active tab's shortcut chips underneath. It
 * replaces a full-width band of links with one row plus one row of chips.
 *
 * Tabs work two ways. Give a group `links` and the tab is a button that swaps
 * the chips below it (home). Give it `href` and pass `activeId` and the tab is
 * a link, so the filter stays in the URL and can be shared (portfolio).
 *
 * The search is a plain GET form, so it still works if the JavaScript never
 * arrives.
 */
export function DiscoverButton({
  groups,
  activeId,
  showSearch = true,
  searchAction = "/products",
  searchPlaceholder = "Search order of service, invitations…",
  searchLabel = "Search products",
  tabsLabel = "Shortcuts by occasion",
  className,
}: {
  groups: readonly DiscoverGroup[];
  /** Drives the active tab from the URL. Omit for local tab state. */
  activeId?: string;
  /** Leave out to drop the search box entirely. */
  showSearch?: boolean;
  searchAction?: string;
  searchPlaceholder?: string;
  /** The accessible name for the search field and its submit button. */
  searchLabel?: string;
  tabsLabel?: string;
  className?: string;
}) {
  const [localId, setLocalId] = useState(groups[0]?.id);
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const spring = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, damping: 20, stiffness: 230, mass: 1.2 };
  const fade = { duration: reduceMotion ? 0 : 0.2 };

  const active =
    groups.find((group) => group.id === (activeId ?? localId)) ?? groups[0];

  const openSearch = () => {
    setSearchOpen(true);
    // The input is always in the DOM, only clipped to nothing, so it takes
    // focus straight away — no waiting on a frame that a hidden tab never runs.
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-stretch gap-3">
        {showSearch && (
        <motion.form
          layout
          transition={spring}
          action={searchAction}
          className={cn(
            "flex h-[52px] items-center overflow-hidden rounded-full border border-line bg-card px-4 shadow-sm",
            searchOpen ? "flex-1" : "",
          )}
        >
          <button
            type={searchOpen ? "submit" : "button"}
            onClick={searchOpen ? undefined : openSearch}
            aria-expanded={searchOpen}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-soft hover:text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="sr-only">
              {searchOpen ? searchLabel : "Open search"}
            </span>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21" y2="21" />
            </svg>
          </button>

          <motion.div
            initial={false}
            animate={{
              width: searchOpen ? "auto" : 0,
              opacity: searchOpen ? 1 : 0,
              marginLeft: searchOpen ? 8 : 0,
            }}
            transition={spring}
            className="flex items-center overflow-hidden"
          >
            <label htmlFor="discover-search" className="sr-only">
              {searchLabel}
            </label>
            <input
              ref={inputRef}
              id="discover-search"
              name="q"
              type="search"
              placeholder={searchPlaceholder}
              tabIndex={searchOpen ? 0 : -1}
              className="w-full min-w-[180px] border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-placeholder"
            />
          </motion.div>

          {searchOpen && (
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-quiet hover:text-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span className="sr-only">Close search</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </motion.form>
        )}

        {/* The tabs stay live while the search is open: fading them out would
            leave a dead, still-visible control sitting in the row. */}
        <motion.div
          layout
          transition={spring}
          className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-1 rounded-full border border-line bg-card p-1.5 shadow-sm"
          role="group"
          aria-label={tabsLabel}
        >
          {groups.map((group) => {
            const isActive = group.id === active?.id;
            const tabClass = cn(
              "relative rounded-full px-5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              isActive ? "text-blue" : "text-ink-quiet hover:text-blue",
            );
            const body = (
              <>
                {isActive && (
                  <motion.span
                    layoutId="discover-tab"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-brand-tint"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", bounce: 0.19, duration: 0.4 }
                    }
                  />
                )}
                <span className="relative">{group.label}</span>
              </>
            );

            return group.href ? (
              <Link
                key={group.id}
                href={group.href}
                aria-current={isActive ? "true" : undefined}
                className={tabClass}
              >
                {body}
              </Link>
            ) : (
              <button
                key={group.id}
                type="button"
                onClick={() => setLocalId(group.id)}
                aria-pressed={isActive}
                className={tabClass}
              >
                {body}
              </button>
            );
          })}
        </motion.div>
      </div>

      {active?.links && (
      <motion.ul
        key={active.id}
        initial={false}
        animate={{ opacity: 1 }}
        transition={fade}
        className="flex flex-wrap gap-2.5"
      >
        {active.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex rounded-full border border-line bg-card px-5 py-2.5 text-[13px] font-medium text-ink-soft hover:border-brand hover:text-blue"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </motion.ul>
      )}
    </div>
  );
}

export default DiscoverButton;
