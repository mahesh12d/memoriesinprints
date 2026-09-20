"use client";

import Link from "next/link";
import { useState } from "react";

export function MobileNav({
  links,
  accountHref,
  accountLabel,
}: {
  links: { href: string; label: string }[];
  accountHref: string;
  accountLabel: string;
}) {
  const [open, setOpen] = useState(false);

  // Closing on click beats reacting to the pathname: it needs no effect, and
  // it also closes when someone taps the link for the page they're already on.
  const close = () => setOpen(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-nav"
        className="flex size-11 items-center justify-center rounded text-charcoal"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-[72px] border-b border-line bg-ivory px-6 pb-6 shadow-sm"
        >
          <nav className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                className="border-b border-line-soft py-4 text-[15px] font-medium text-ink-soft"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={accountHref}
              onClick={close}
              className="border-b border-line-soft py-4 text-[15px] font-medium text-ink-soft"
            >
              {accountLabel}
            </Link>
          </nav>

          <Link
            href="/quote"
            onClick={close}
            className="mt-5 block rounded-[2px] bg-charcoal px-5 py-3.5 text-center text-sm font-semibold text-ivory"
          >
            Request a Quote
          </Link>
        </div>
      )}
    </div>
  );
}
