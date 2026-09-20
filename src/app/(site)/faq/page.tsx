import type { Metadata } from "next";
import { FAQS } from "@/content/home";
import { STUDIO } from "@/lib/studio";
import { Breadcrumb, CtaBand, Section } from "@/components/site/section";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Turnaround times, minimum orders, proofing, delivery and payment — answered.",
};

export default function FaqPage() {
  return (
    <>
      <Section>
        <Breadcrumb trail={[{ href: "/", label: "Home" }, { label: "FAQ" }]} />

        <div className="mb-12 flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">Frequently asked</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            The questions we&rsquo;re asked most often. If yours isn&rsquo;t here, call the
            studio on {STUDIO.phone} or email {STUDIO.email} — {STUDIO.openingHours}.
          </p>
        </div>

        <div className="max-w-[80ch] divide-y divide-line border-y border-line">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-6">
              <summary className="flex cursor-pointer items-center justify-between gap-6 font-display text-lg marker:content-none">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-faint transition-transform group-open:rotate-45"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 max-w-[70ch] text-[15px] leading-relaxed text-ink-muted">
                {faq.a}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <CtaBand
        title="Still not sure?"
        body="Send us the details of what you're planning and we'll tell you honestly what's possible and what it will cost."
        primary={{ href: "/quote", label: "Request a quote" }}
        secondary={{ href: "/guide", label: "Read the process" }}
      />
    </>
  );
}
