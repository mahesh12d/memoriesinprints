import Link from "next/link";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  intro,
  badge,
  dark = false,
  children,
  footer,
}: {
  title: string;
  intro?: string;
  badge?: string;
  dark?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main
      className={`flex min-h-screen flex-col ${dark ? "bg-night-deep" : "bg-ivory"}`}
    >
      <div className="px-16 py-8">
        <Link
          href="/"
          className={`font-display text-lg font-semibold ${
            dark ? "text-ink-faint" : "text-charcoal"
          }`}
        >
          Memories in Prints
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center px-16 pb-12">
        <div
          className={`flex w-[420px] flex-col gap-[22px] rounded-lg p-11 ${
            dark ? "bg-ivory" : "border border-line bg-white"
          }`}
        >
          <div className="flex flex-col items-center gap-1.5 text-center">
            {badge && (
              <span className="mb-1.5 rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-charcoal">
                {badge}
              </span>
            )}
            <h1 className="text-2xl">{title}</h1>
            {intro && <p className="text-[13px] text-ink-muted">{intro}</p>}
          </div>

          {children}
        </div>
      </div>

      {footer && (
        <div
          className={`px-16 pb-10 text-center text-[13px] ${
            dark ? "text-ink-faint" : "text-ink-muted"
          }`}
        >
          {footer}
        </div>
      )}
    </main>
  );
}
