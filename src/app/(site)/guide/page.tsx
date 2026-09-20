import type { Metadata } from "next";
import { ARTICLES, FINISHES, ORDER_PROCESS } from "@/content/home";
import {
  Breadcrumb,
  CtaBand,
  Section,
  SectionHeading,
} from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";

export const metadata: Metadata = {
  title: "Process",
  description:
    "The papers and finishes we work with, how an order moves through the studio, and guides from the bench.",
};

export default function GuidePage() {
  return (
    <>
      <Section>
        <Breadcrumb trail={[{ href: "/", label: "Home" }, { label: "Process" }]} />

        <div className="flex max-w-[62ch] flex-col gap-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-warm">
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
          eyebrow="Paper &amp; finishing"
          title="What sets a print studio apart"
          intro="The stock, the finish, the care in the fold — the things you notice in the hand rather than on a screen."
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {FINISHES.map((finish) => (
            <li key={finish.label} className="flex flex-col gap-3">
              <ImagePlaceholder
                caption={finish.caption}
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

      <Section>
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
                className="aspect-[4/3] w-full rounded-md"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warm">
                {step.label}
              </span>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="warm">
        <SectionHeading
          eyebrow="From the studio"
          title="Guides &amp; resources"
          intro="Notes from the studio on paper, planning and what to expect when you order with us."
        />

        <ul className="grid gap-8 lg:grid-cols-3">
          {ARTICLES.map((article) => (
            <li
              key={article.slug}
              className="flex flex-col overflow-hidden rounded-md border border-line bg-white"
            >
              <ImagePlaceholder
                caption={article.caption}
                className="aspect-[16/9] w-full"
              />
              <div className="flex flex-1 flex-col gap-3 p-7">
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-warm">
                  {article.tag}
                </span>
                <h3 className="font-display text-xl leading-snug">
                  {article.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-ink-muted">
                  {article.excerpt}
                </p>
                <span className="mt-auto pt-3 text-[12px] text-ink-faint">
                  {article.date}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-[13px] text-ink-faint">
          Articles are outlined and ready for the studio to write — the pages
          themselves come with the content milestone.
        </p>
      </Section>

      <CtaBand
        title="Still have a question?"
        body="If something here doesn't cover it, ask us directly. We'd rather answer now than have you guess."
        primary={{ href: "/quote", label: "Ask the studio" }}
        secondary={{ href: "/faq", label: "Read the FAQ" }}
      />
    </>
  );
}
