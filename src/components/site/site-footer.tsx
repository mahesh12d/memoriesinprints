import Link from "next/link";
import { STUDIO } from "@/lib/studio";

/**
 * The three columns carried over from memoriesinprints.com.
 *
 * Two of the old site's links have no page here yet, so they point at the
 * nearest thing rather than at a 404: "Process" and "Turnaround Times" both
 * go to the guide, which is where turnaround and the order of work are
 * written up. Build /process and they move.
 */
const COLUMNS = [
  {
    title: "Studio",
    links: [
      // Called Designs here since the rename; same page as the old Portfolio.
      { href: "/portfolio", label: "Designs" },
      { href: "/guide", label: "Process" },
      { href: "/about", label: "About Us" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/contact", label: "Contact Us" },
      { href: "/guide", label: "Turnaround Times" },
      { href: "/guide#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms & Conditions" },
      { href: "/cookies", label: "Cookies Policy" },
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
      className="flex size-9 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white hover:bg-white/10 hover:text-white"
    >
      {children}
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#416351] bg-[#4D745F] text-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <span className="font-display text-xl font-semibold text-white">
            Memories in Prints
          </span>
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-white/80">
            A full-service design and print studio.
          </p>
          <p className="max-w-[38ch] text-[13px] leading-relaxed text-white/75">
            Serving families, brands, and Organisations worldwide.
          </p>
          <p className="text-[13px] leading-relaxed text-white/75">
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
            <SocialLink href={STUDIO.linkedin} label="LinkedIn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="3" />
                <line x1="7" y1="10" x2="7" y2="17" />
                <line x1="7" y1="6.6" x2="7" y2="6.6" />
                <path d="M11.5 17v-4a2.5 2.5 0 0 1 5 0v4" />
                <line x1="11.5" y1="10" x2="11.5" y2="17" />
              </svg>
            </SocialLink>
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title} className="flex flex-col gap-4">
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white">
              {column.title}
            </span>
            <ul className="flex flex-col gap-2.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-white/75 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-2 px-6 py-6 text-[12px] text-white/70 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          {/* The year moves on its own; nobody has to remember in January. */}
          <span>
            ©{new Date().getFullYear()} Memories in Prints&trade; — A brand of{" "}
            {STUDIO.legalEntity}. All rights reserved
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-white/60">{STUDIO.domain}</span>
            <a href={`mailto:${STUDIO.email}`} className="hover:text-white">
              {STUDIO.email}
            </a>
            <a href={`tel:${STUDIO.phone.replace(/\s+/g, "")}`} className="hover:text-white">
              {STUDIO.phone}
            </a>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `Memories in Prints, ${STUDIO.city}, UK`,
              )}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold hover:text-white"
            >
              View Map
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
