import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { isStaff } from "@/lib/auth/guards";
import { MobileNav } from "./mobile-nav";

const LINKS = [
  { href: "/portfolio", label: "Our Work" },
  { href: "/products", label: "Products" },
  { href: "/guide", label: "Process" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export async function SiteHeader() {
  const session = await getSession("site");

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
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-6 px-6 sm:px-10">
        <Link
          href="/"
          className="font-display text-lg font-semibold whitespace-nowrap"
        >
          Memories in Prints
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-soft hover:text-blue"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href={accountHref}
            className="text-sm font-semibold text-ink-soft hover:text-blue"
          >
            {accountLabel}
          </Link>
          <Link
            href="/quote"
            className="rounded-[2px] bg-brand px-5 py-3 text-[13px] font-semibold text-on-accent hover:bg-blue-deep"
          >
            Request a Quote
          </Link>
        </div>

        <MobileNav
          links={LINKS}
          accountHref={accountHref}
          accountLabel={accountLabel}
        />
      </div>
    </header>
  );
}
