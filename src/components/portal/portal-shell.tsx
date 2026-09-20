import Link from "next/link";
import type { ReactNode } from "react";
import { PortalNav, type NavItem } from "./portal-nav";

export type { NavItem };

type Variant = "customer" | "staff" | "admin";

const BADGE: Record<Variant, { label: string; className: string }> = {
  customer: { label: "My account", className: "bg-brand text-white" },
  staff: { label: "Studio staff", className: "bg-brand text-white" },
  admin: { label: "Admin", className: "bg-brand text-blue" },
};

const SIDEBAR_BG: Record<Variant, string> = {
  customer: "bg-blue",
  staff: "bg-blue",
  admin: "bg-blue-deep",
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
      <aside
        className={`flex w-[230px] shrink-0 flex-col justify-between px-[18px] py-7 ${SIDEBAR_BG[variant]}`}
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
        </div>

        <div className="flex flex-col gap-3 px-1.5">
          <div className="flex items-center gap-2.5 border-t border-blue-deep pt-4">
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-blue-deep text-[11px] font-bold text-white">
              {initials(user.name)}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-white">
                {user.name}
              </span>
              <span className="text-[11px] text-on-blue-muted">
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
        className="text-[13px] font-semibold text-on-blue-muted hover:text-white"
      >
        Log out
      </button>
    </form>
  );
}
