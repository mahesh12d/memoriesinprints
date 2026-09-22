import type { Metadata } from "next";
import { ARTICLES, FAQS, FINISHES, ORDER_PROCESS } from "@/content/home";
import { STUDIO } from "@/lib/studio";
import { Breadcrumb, Section, SectionHeading } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";

export const metadata: Metadata = {
  title: "Guide",
  description:
    "How an order works from start to finish, the papers and finishes we print on, answers to the questions we are asked most, and guides from the studio.",
};

export default function GuidePage() {
  return (
    <>
      <Section>
        <Breadcrumb
          trail={[{ href: "/", label: "Home" }, { label: "Guide" }]}
        />

        <div className="flex max-w-[62ch] flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
            How it works
          </span>
          <h1 className="text-[40px] leading-tight">
            Your guide to working with us
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Everything you need to know before you order — the papers and
            finishes we work with, how an order moves from browsing to your
            door, and a few guides from the studio along the way.
          </p>
        </div>
      </Section>

      <Section tone="white">
        <SectionHeading
          eyebrow="The order process"
          title="From browsing to your door"
          intro="A walkthrough of how any order moves through the studio, start to finish."
        />

        <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER_PROCESS.map((step) => (
            <li key={step.label} className="flex flex-col gap-4">
              <ImagePlaceholder
                caption={step.caption}
                fileName={step.file}
                className="aspect-[4/3] w-full rounded-md"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                {step.label}
              </span>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Paper &amp; finishing"
          title="What sets a print studio apart"
          intro="The stock, the finish, the care in the fold — the things you notice in the hand rather than on a screen."
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {FINISHES.map((finish) => (
            <li key={finish.label} className="flex flex-col gap-3">
              <ImagePlaceholder
                caption={finish.caption}
                fileName={finish.file}
                className="aspect-square w-full rounded-md"
              />
              <h3 className="font-display text-[17px]">{finish.label}</h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">
                {finish.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="white" id="faq">
        <SectionHeading
          eyebrow="Questions"
          title="Answered before you ask"
          intro={`The questions we're asked most often. If yours isn't here, call the studio on ${STUDIO.phone} or email ${STUDIO.email} — ${STUDIO.openingHours}.`}
        />

        <div className="max-w-[80ch] divide-y divide-line border-y border-line">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-6">
              <summary className="flex cursor-pointer items-center justify-between gap-6 font-display text-lg marker:content-none">
                {faq.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-ink-quiet transition-transform group-open:rotate-45"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  >
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

      <Section tone="grey">
        <SectionHeading
          eyebrow="From the studio"
          title="Guides &amp; resources"
          intro="Notes from the studio on paper, planning and what to expect when you order with us."
        />

        <ul className="grid gap-8 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <li
              key={article.slug}
              className="flex flex-col overflow-hidden rounded-md border border-line bg-card"
            >
              <ImagePlaceholder
                caption={article.caption}
                fileName={article.file}
                className="aspect-[16/9] w-full"
              />
              <div className="flex flex-1 flex-col gap-3 p-7">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                  {article.tag}
                </span>
                <h3 className="font-display text-xl leading-snug">
                  {article.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  {article.excerpt}
                </p>
                <span className="mt-auto pt-3 text-[12px] text-ink-quiet">
                  {article.date}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[13px] text-ink-quiet">
          Articles are outlined and ready for the studio to write — the pages
          themselves come with the content milestone.
        </p>
      </Section>
    </>
  );
}
