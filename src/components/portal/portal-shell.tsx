import Link from "next/link";
import type { ReactNode } from "react";
import { PortalNav, type NavItem } from "./portal-nav";

export type { NavItem };

type Variant = "customer" | "staff" | "admin";

const BADGE: Record<Variant, { label: string; className: string }> = {
  customer: { label: "My account", className: "bg-warm text-ivory" },
  staff: { label: "Studio staff", className: "bg-sage text-ivory" },
  admin: { label: "Admin", className: "bg-gold text-charcoal" },
};

const SIDEBAR_BG: Record<Variant, string> = {
  customer: "bg-night",
  staff: "bg-night",
  admin: "bg-night-deep",
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
  children,
}: {
  variant: Variant;
  nav: NavItem[];
  user: { name: string; roleLabel: string };
  logout: ReactNode;
  children: ReactNode;
}) {
  const badge = BADGE[variant];

  return (
    <div className="flex min-h-screen bg-ivory">
      <aside
        className={`flex w-[230px] shrink-0 flex-col justify-between px-[18px] py-7 ${SIDEBAR_BG[variant]}`}
      >
        <div className="flex flex-col gap-[26px]">
          <div className="flex flex-col gap-2 px-1.5">
            <Link
              href="/"
              className="font-display text-[17px] font-semibold text-ivory"
            >
              Memories in Prints
            </Link>
            <span
              className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ${badge.className}`}
            >
              {badge.label}
            </span>
          </div>

          <PortalNav items={nav} />
        </div>

        <div className="flex flex-col gap-3 px-1.5">
          <div className="flex items-center gap-2.5 border-t border-night-line pt-4">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-night-chip text-[11px] font-bold text-ivory">
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-ivory">
                {user.name}
              </span>
              <span className="text-[11px] text-ink-faint">
                {user.roleLabel}
              </span>
            </span>
          </div>
          {logout}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
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
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-line px-10">
      <h1 className="text-[22px]">{title}</h1>
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
        className="text-[13px] font-semibold text-ink-pale hover:text-ivory"
      >
        Log out
      </button>
    </form>
  );
}
