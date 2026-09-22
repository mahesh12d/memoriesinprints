import Link from "next/link";
import {
  CASE_STUDY_STEPS,
  FAQS,
  QUICK_LINKS,
  STUDIO_VALUES,
  TESTIMONIALS,
  TRUSTED_BY,
} from "@/content/home";
import { Section, SectionHeading } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { ImageAutoSlider } from "@/components/ui/image-auto-slider";
import { DiscoverButton } from "@/components/ui/discover-button";

export default async function HomePage() {
  return (
    <>
      {/* HERO */}
      {/* Pulled up under the sticky header so the banner runs to the very top
          of the page; the scrim keeps the white nav type readable over it. */}
      <section className="relative -mt-[72px]">
        <ImagePlaceholder
          caption="[Photograph — full-width banner: printed order of service booklets and a wedding invitation suite, styled flat lay]"
          fileName="hero-banner.webp"
          className="h-[412px] w-full sm:h-[492px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[180px] bg-gradient-to-b from-black/55 via-black/25 to-transparent"
        />

        <div className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10">
          <div className="flex max-w-[62ch] flex-col gap-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
              Independent print studio · Funeral Service Association member
            </span>
            <h1 className="text-[40px] leading-[1.15] sm:text-[52px]">
              Stationery that holds a life, and a love, with care.
            </h1>
            <p className="text-[16px] leading-relaxed text-ink-muted">
              We design and print funeral stationery for directors and families,
              and wedding stationery for couples — every piece proofed, approved
              and finished by hand before it reaches you.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-band-deep"
              >
                Request a quote
              </Link>
              <Link
                href="/portfolio"
                className="rounded-[2px] border border-field-line px-7 py-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-grey"
              >
                View the portfolio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* HELP */}
      <Section tone="white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="text-[32px] leading-tight sm:text-[38px]">
              We are here to help you
            </h2>
            <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-muted">
              Whatever brings you to us — arranging a funeral, planning a
              wedding, or marking any occasion in between — we start by
              listening. Every piece is designed around your story, proofed with
              you before it goes to print, and delivered to the timeline you
              need.
            </p>
          </div>
          <ImagePlaceholder
            caption="[Photograph — a member of the studio team proofing a printed piece by hand]"
            fileName="studio-proofing.webp"
            className="h-[320px] w-full rounded-md"
          />
        </div>
      </Section>

      {/* POPULAR DESIGNS */}
      <Section>
        <SectionHeading
          title="Our popular designs"
          intro="We offer a wide range of personalised services and printed materials to help you honour, remember and celebrate meaningful moments."
          action={{ href: "/portfolio", label: "View full portfolio →" }}
        />

        <DiscoverButton groups={QUICK_LINKS} className="mb-10" />

        <ImageAutoSlider />
      </Section>

      {/* CASE STUDY */}
      <Section tone="white">
        <SectionHeading
          eyebrow="Featured project"
          title="From brief to finished booklet"
          intro="One order of service, from first conversation to the printed piece — a look at how every project moves through the studio."
        />

        <ol className="grid gap-8 lg:grid-cols-3">
          {CASE_STUDY_STEPS.map((step) => (
            <li key={step.label} className="flex flex-col gap-4">
              <ImagePlaceholder
                caption={step.caption}
                fileName={step.file}
                className="aspect-[4/3] w-full rounded-md"
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                {step.label}
              </span>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* VALUES */}
      <Section tone="blue">
        <SectionHeading
          tone="light"
          title="Where craft meets care"
          eyebrow="How we work"
        />

        <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STUDIO_VALUES.map((value) => (
            <li key={value.n} className="flex flex-col gap-3">
              <span className="font-display text-[28px] text-brand-on-dark">
                {value.n}
              </span>
              <h3 className="text-lg text-white">{value.title}</h3>
              <p className="text-[14px] leading-relaxed text-white/65">
                {value.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* TRUSTED BY */}
      <Section tone="grey">
        <div className="flex flex-col items-center gap-8 text-center">
          <span className="rounded-full bg-good-tint px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-good-deep">
            FSA Member — Funeral Service Association
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-quiet">
            As trusted by
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {TRUSTED_BY.map((name, index) => (
              <li
                key={`${name}-${index}`}
                className="font-display text-[17px] text-ink-pale"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* TESTIMONIALS */}
      <Section>
        <ul className="grid gap-8 lg:grid-cols-3">
          {TESTIMONIALS.map((quote, idx) => (
            <li
              key={`${quote.attribution}-${idx}`}
              className="flex flex-col gap-5 rounded-md border border-line bg-card p-8"
            >
              <blockquote className="font-display text-[19px] leading-[1.5]">
                “{quote.text}”
              </blockquote>
              <cite className="text-[13px] not-italic text-ink-quiet">
                — {quote.attribution}
              </cite>
            </li>
          ))}
        </ul>
      </Section>

      {/* INTERNATIONAL */}
      <Section tone="white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <h2 className="text-[32px] leading-tight">
              Wherever you are, we can reach you
            </h2>
            <p className="max-w-[54ch] text-[15px] leading-relaxed text-ink-muted">
              Alongside our studio clients, we design, print and ship funeral
              and wedding stationery internationally — proofs are shared and
              approved online, so distance is never a reason to compromise on
              the details.
            </p>
            <Link
              href="/contact"
              className="mt-2 w-fit rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-band-deep"
            >
              Get a quote, wherever you are
            </Link>
          </div>
          <ImagePlaceholder
            caption="[Illustration — world map with pins marking where orders have shipped]"
            fileName="shipping-map.svg"
            className="h-[300px] w-full rounded-md"
          />
        </div>
      </Section>

      {/* FAQ PREVIEW */}
      <Section>
        <SectionHeading
          title="Common questions"
          action={{ href: "/guide#faq", label: "View full FAQ →" }}
        />

        <dl className="divide-y divide-line border-y border-line">
          {FAQS.slice(0, 4).map((faq) => (
            <div
              key={faq.q}
              className="grid gap-3 py-7 lg:grid-cols-[1fr_1.4fr]"
            >
              <dt className="font-display text-lg">{faq.q}</dt>
              <dd className="text-[15px] leading-relaxed text-ink-muted">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  );
}
