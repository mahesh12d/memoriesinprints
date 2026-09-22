import Link from "next/link";
import type { ReactNode } from "react";
import { PortalNav, type NavItem } from "./portal-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export type { NavItem };

type Variant = "customer" | "staff" | "admin";

const BADGE: Record<Variant, { label: string; className: string }> = {
  customer: { label: "My account", className: "bg-brand text-white" },
  staff: { label: "Studio staff", className: "bg-brand text-white" },
  admin: { label: "Admin", className: "bg-brand text-blue" },
};

/**
 * The way out to the website.
 *
 * A customer ordering their third set of booklets was going up to the logo,
 * landing on the homepage and navigating down again. Frequent buyers want the
 * shop, so that is where their link goes; the studio's goes to the front page,
 * which is the version of the site they actually need to look at.
 */
const SHOP: Record<Variant, { href: string; label: string }> = {
  customer: { href: "/products", label: "Order something new" },
  staff: { href: "/", label: "View the website" },
  admin: { href: "/", label: "View the website" },
};

const SIDEBAR_BG: Record<Variant, string> = {
  customer: "bg-band",
  staff: "bg-band",
  admin: "bg-band-deep",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Sidebar + content column. Each page supplies its own PortalHeader. */
export function PortalShell({
  variant,
  nav,
  user,
  logout,
  bell,
  children,
}: {
  variant: Variant;
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  logout: ReactNode;
  /** Optional notification bell, rendered under the nav. */
  bell?: ReactNode;
  children: ReactNode;
}) {
  const badge = BADGE[variant];

  return (
    <div className="flex min-h-screen bg-surface">
      {/*
        Pinned rather than scrolling with the page: the footer holds log out and
        the theme switch, and on a long order table those were sitting a
        thousand pixels below the fold.
      */}
      <aside
        className={`sticky top-0 flex h-screen w-[230px] shrink-0 flex-col justify-between overflow-y-auto px-[18px] py-7 ${SIDEBAR_BG[variant]}`}
      >
        <div className="flex flex-col gap-[26px]">
          <div className="flex flex-col gap-2 px-1.5">
            <Link
              href="/"
              className="font-display text-[17px] font-semibold text-white"
            >
              Memories in Prints
            </Link>
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <PortalNav items={nav} />
            {bell}
          </div>

          <Link
            href={SHOP[variant].href}
            className="mx-1.5 flex items-center justify-between gap-2 rounded-[3px] border border-white/20 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-white/10"
          >
            {SHOP[variant].label}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 4h6v6M20 4l-9 9" />
              <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
            </svg>
          </Link>
        </div>

        <div className="flex flex-col gap-3 px-1.5">
          <div className="border-t border-band-deep pt-4">{logout}</div>
        </div>
      </aside>

      {/*
        Who you are sits in the top right, over the page's own header bar.
        Overlaid rather than passed down because two dozen pages render that
        bar themselves, and none of them should have to know about the user.

        ponytail: the cluster owns a fixed 300px slot and PortalHeader reserves
        exactly that, so the two can't collide whatever a page puts in its
        actions. Widen both together if the cluster ever grows.
      */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="pointer-events-none absolute right-0 top-0 z-10 flex h-[72px] w-[300px] items-center justify-end pr-10">
          <div className="pointer-events-auto flex items-center gap-4">
            <ThemeToggle />

            <span className="h-7 w-px bg-line" aria-hidden="true" />

            <div className="flex items-center gap-2.5">
              <span className="flex min-w-0 flex-col text-right">
                <span className="max-w-[110px] truncate text-[13px] font-semibold leading-tight">
                  {user.name}
                </span>
                <span className="text-[11px] leading-tight text-ink-quiet">
                  {user.roleLabel}
                </span>
              </span>
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-band text-[12px] font-bold text-white">
                {initials(user.name)}
              </span>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}

export function PortalHeader({
  title,
  actions,
}: {
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between gap-6 border-b border-line pl-10 pr-[300px]">
      <h1 className="truncate text-[22px]">{title}</h1>
      {actions}
    </header>
  );
}

export function PortalBody({ children }: { children: ReactNode }) {
  return <main className="flex-1 p-10">{children}</main>;
}

export function LogoutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <button
        type="submit"
        className="text-[13px] font-semibold text-on-blue-muted hover:text-white"
      >
        Log out
      </button>
    </form>
  );
}
