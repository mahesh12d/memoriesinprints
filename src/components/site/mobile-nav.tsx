"use client";

import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function MobileNav({
  links,
  accountHref,
  accountLabel,
}: {
  links: { href: string; label: string; items?: { href: string; label: string }[] }[];
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
        className="flex size-11 items-center justify-center rounded text-blue group-data-[overlay=true]/nav:text-white"
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
          className="absolute inset-x-0 top-[72px] border-b border-line bg-surface px-6 pb-6 shadow-sm"
        >
          <nav className="flex flex-col">
            {links.map((link) => (
              <div key={link.href} className="border-b border-line-soft">
                <Link
                  href={link.href}
                  onClick={close}
                  className="block py-4 text-[15px] font-medium text-ink-soft"
                >
                  {link.label}
                </Link>
                {link.items && (
                  <ul className="-mt-1 flex flex-col pb-3 pl-4">
                    {link.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={close}
                          className="block py-2.5 text-[14px] text-ink-muted"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <Link
              href={accountHref}
              onClick={close}
              className="block border-b border-line-soft py-4 text-[15px] font-medium text-ink-soft"
            >
              {accountLabel}
            </Link>
          </nav>

          <div className="mt-5 flex items-center justify-end">
            <ThemeToggle />
          </div>
        </div>
      )}
    </div>
  );
}
