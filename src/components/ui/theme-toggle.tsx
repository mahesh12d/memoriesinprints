"use client";

import { cn } from "@/lib/utils";

/**
 * Day/night switch.
 *
 * Everything visible — the knob, the icons, the label a screen reader reads —
 * is driven by the `dark:` variant rather than React state. The inline script
 * in the root layout has already set `.dark` before the first paint, so the
 * switch is correct immediately and there is nothing to hydrate: no state, no
 * mismatch, no `suppressHydrationWarning`.
 *
 * The button is named for what it will do rather than carrying `aria-pressed`,
 * because a pressed state rendered on the server can only ever be a guess.
 */
export function ThemeToggle({
  tone = "page",
  className,
}: {
  /**
   * The portal sidebar is dark in both themes, so its switch can't borrow the
   * page tokens — they'd leave it invisible against the sidebar in dark mode.
   */
  tone?: "page" | "sidebar";
  className?: string;
}) {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage blocked (private browsing): the theme just won't persist.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "relative flex h-8 w-16 shrink-0 items-center rounded-full border p-1 transition-colors",
        tone === "sidebar"
          ? "border-white/25 bg-white/10"
          : "border-line bg-card",
        className,
      )}
    >
      <span className="sr-only dark:hidden">Switch to the dark theme</span>
      <span className="sr-only hidden dark:block">
        Switch to the light theme
      </span>

      {/* The knob: left on light, slides right on dark. */}
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 translate-x-0 items-center justify-center rounded-full transition-transform duration-300 dark:translate-x-8 motion-reduce:transition-none",
          tone === "sidebar"
            ? "bg-white dark:bg-white"
            : "bg-surface-grey dark:bg-band",
        )}
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("dark:hidden", tone === "sidebar" ? "text-band-deep" : "text-ink-soft")}
        >
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2M12 19.4v2M4.2 12h-2M21.8 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M17.7 6.3l1.4-1.4M4.9 19.1l1.4-1.4" />
        </svg>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn("hidden dark:block", tone === "sidebar" ? "text-band-deep" : "text-brand-on-dark")}
        >
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
        </svg>
      </span>
    </button>
  );
}

export default ThemeToggle;
