import Link from "next/link";
import { STUDIO } from "@/lib/studio";

const COLUMNS = [
  {
    title: "Shop",
    links: [
      { href: "/products?category=funeral", label: "Funeral stationery" },
      { href: "/products?category=wedding", label: "Wedding stationery" },
      { href: "/products?category=celebration", label: "Celebrations" },
      { href: "/quote", label: "Get a Quote" },
    ],
  },
  {
    title: "Studio",
    links: [
      { href: "/portfolio", label: "Our Work" },
      { href: "/guide", label: "Process" },
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/cookies", label: "Cookies" },
    ],
  },
];

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      rel="noreferrer noopener"
      target="_blank"
      className="flex size-9 items-center justify-center rounded-full border border-white/20 text-ivory/80 transition-colors hover:border-white/40 hover:text-ivory"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-night text-ivory">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <span className="font-display text-lg font-semibold">
            Memories in Prints
          </span>
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-ivory/60">
            Bespoke funeral stationery, memorial keepsakes and wedding
            stationery, printed with care in {STUDIO.city}, UK.
          </p>
          <p className="text-[13px] leading-relaxed text-ivory/60">
            Proud member of the Funeral Service Association (FSA)
          </p>

          <div className="mt-2 flex gap-2.5">
            <SocialLink href={STUDIO.instagram} label="Instagram">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <circle cx="12" cy="12" r="4" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </SocialLink>
            <SocialLink href={STUDIO.facebook} label="Facebook">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </SocialLink>
            <SocialLink href={STUDIO.pinterest} label="Pinterest">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.5 18.5 12 8" />
                <path d="M10.4 12.6a2.8 2.8 0 0 0 4.3-2.3 3.3 3.3 0 0 0-6.6 0" />
              </svg>
            </SocialLink>
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ivory/45">
              {column.title}
            </span>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-ivory/75 hover:text-ivory"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-night-line">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-6 text-[12px] text-ivory/50 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span>
            © {new Date().getFullYear()} Memories in Prints. All rights
            reserved.
          </span>
          <span>
            {STUDIO.email} · {STUDIO.phone}
          </span>
        </div>
      </div>
    </footer>
  );
}
