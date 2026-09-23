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
      {/*
        The photograph fills the first screen on its own, with the words over
        it, so the whole of it is visible on landing rather than a band of it.

        73px is the header — its 72px bar plus the 1px border. The bar is
        sticky and still takes its space in the flow, so pulling the section up
        by exactly that much lands its top on the top of the viewport, with the
        photograph running behind the transparent nav. The height is then a
        plain 100svh and the bottom edge sits on the fold.
      */}
      <section className="relative -mt-[73px] flex min-h-[100svh] items-center overflow-hidden">
        <ImagePlaceholder
          caption="[Photograph — full-bleed banner: printed order of service booklets and a wedding invitation suite, styled flat lay]"
          fileName="hero-banner.webp"
          // Dark, so the empty slot previews roughly what the scrimmed
          // photograph will look like behind the white type.
          tone="dark"
          className="absolute inset-0 h-full w-full"
        />

        {/*
          Three scrims, each doing a different job.

          Below lg the words run the width of the screen, so the whole
          photograph is darkened evenly. From lg the words sit in the left
          third, so the shading is a left-to-right gradient instead: heavy
          enough to read against on the left, gone by the right, which leaves
          most of the photograph showing at full strength.

          The top band is for the nav, which sits over whatever happens to be
          at the top of the picture.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-black/45 lg:hidden"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/80 via-black/45 to-transparent lg:block"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-black/60 to-transparent"
        />

        {/* Same container as the header, so the heading lines up with the logo. */}
        <div className="relative mx-auto w-full max-w-[1200px] px-6 pb-20 pt-[calc(73px+4rem)] sm:px-10">
          <div className="flex max-w-[620px] flex-col gap-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
              Independent print studio · Funeral Service Association member
            </span>
            <h1 className="text-[38px] leading-[1.12] text-white sm:text-[48px] lg:text-[58px]">
              Stationery that holds a life, and a love, with care.
            </h1>
            <p className="max-w-[52ch] text-[16px] leading-relaxed text-white/85 sm:text-[17px]">
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
                className="rounded-[2px] border border-white/60 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10"
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
