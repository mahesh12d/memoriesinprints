import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { getCartCount } from "@/lib/cart/cart";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/catalogue";
import { HeaderShell } from "./header-shell";
import { MobileNav } from "./mobile-nav";
import { LoginPopupTrigger } from "./login-popup-trigger";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const PORTFOLIO_ITEMS = CATEGORIES.map((value) => ({
  href: `/portfolio?category=${value}`,
  label: CATEGORY_LABEL[value],
}));

const LINKS = [
  { href: "/portfolio", label: "Designs", items: PORTFOLIO_ITEMS },
  { href: "/products", label: "Products" },
  { href: "/corporate", label: "Corporate Printing" },
  { href: "/guide", label: "Guide" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact Us" },
];

/** White type over the banner photograph, ink everywhere else. */
const NAV_LINK =
  "text-sm font-medium text-ink-soft hover:text-blue group-data-[overlay=true]/nav:text-white group-data-[overlay=true]/nav:hover:text-white/70";

export async function SiteHeader() {
  const session = await getSession("site");
  const cartCount = await getCartCount();

  const accountHref = session
    ? isStaff(session.user.role)
      ? "/staff"
      : "/account"
    : "/login";

  const accountLabel = session
    ? isStaff(session.user.role)
      ? "Studio"
      : "My account"
    : "Login / Signup";

  return (
    <HeaderShell>
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-6 px-6 sm:px-10">
        <Link
          href="/"
          className="font-display text-lg font-semibold whitespace-nowrap group-data-[overlay=true]/nav:text-white"
        >
          Memories in Prints
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) =>
            link.items ? (
              // Hover opens it for a pointer, focus-within for a keyboard —
              // so the panel needs no state and no escape handling.
              <div key={link.href} className="group/menu relative">
                <Link href={link.href} className={`${NAV_LINK} flex items-center gap-1.5`}>
                  {link.label}
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
                    className="transition-transform group-hover/menu:rotate-180 group-focus-within/menu:rotate-180"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </Link>

                <div className="invisible absolute left-0 top-full z-10 pt-3 opacity-0 transition-opacity group-hover/menu:visible group-hover/menu:opacity-100 group-focus-within/menu:visible group-focus-within/menu:opacity-100">
                  <ul className="min-w-[190px] rounded-[2px] border border-line bg-surface py-2 shadow-lg">
                    {link.items.map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className="block px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-grey hover:text-blue"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <Link key={link.href} href={link.href} className={NAV_LINK}>
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {session ? (
            <Link href={accountHref} className={`${NAV_LINK} font-semibold`}>
              {accountLabel}
            </Link>
          ) : (
            <LoginPopupTrigger
              label={accountLabel}
              className={`${NAV_LINK} font-semibold`}
            />
          )}
          <Link
            href="/cart"
            className={`${NAV_LINK} flex items-center gap-2 font-semibold`}
          >
            Cart
            {cartCount > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-on-accent">
                {cartCount}
              </span>
            )}
          </Link>
        </div>

        <MobileNav
          links={LINKS}
          accountHref={accountHref}
          accountLabel={accountLabel}
        />
      </div>
    </HeaderShell>
  );
}
