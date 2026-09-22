"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * On the home page the banner photograph runs to the very top of the page and
 * the header sits on top of it, so the bar is transparent with white type
 * until the first scroll. Everywhere else — and on home once scrolled — it is
 * the solid bar. `data-overlay` drives the child colours through the
 * `group-data-[overlay=true]/nav:` variants in SiteHeader.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const overlay = pathname === "/" && !scrolled;

  return (
    <header
      data-overlay={overlay ? "true" : "false"}
      className={`group/nav sticky top-0 z-40 border-b transition-colors duration-200 ${
        overlay
          ? "border-transparent bg-transparent"
          : "border-line bg-surface/95 backdrop-blur"
      }`}
    >
      {children}
    </header>
  );
}
