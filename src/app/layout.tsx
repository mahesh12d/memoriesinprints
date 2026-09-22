import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Memories in Prints",
    template: "%s — Memories in Prints",
  },
  description:
    "Funeral and wedding stationery, printed with care in the United Kingdom.",
};

/**
 * Applies the saved theme before the first paint, so nobody gets a white flash
 * on the way to a dark page. It has to be inline and blocking to beat the
 * render — a module or an effect would both be too late.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en-GB"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
