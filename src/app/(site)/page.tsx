import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItems } from "@/db/schema";
import {
  CASE_STUDY_STEPS,
  FAQS,
  QUICK_LINKS,
  STUDIO_VALUES,
  TESTIMONIALS,
  TRUSTED_BY,
} from "@/content/home";
import { CtaBand, Section, SectionHeading } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";
import { CATEGORY_LABEL } from "@/lib/catalogue";

export default async function HomePage() {
  const work = await db
    .select({
      slug: portfolioItems.slug,
      title: portfolioItems.title,
      category: portfolioItems.category,
    })
    .from(portfolioItems)
    .where(eq(portfolioItems.isPublished, true))
    .orderBy(asc(portfolioItems.sortOrder))
    .limit(6);

  return (
    <>
      {/* HERO */}
      <section className="relative">
        <ImagePlaceholder
          caption="[Photograph — full-width banner: printed order of service booklets and a wedding invitation suite, styled flat lay]"
          className="h-[340px] w-full sm:h-[420px]"
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
                href="/quote"
                className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-blue-deep"
              >
                Request a quote
              </Link>
              <Link
                href="/portfolio"
                className="rounded-[2px] border border-field-line px-7 py-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-grey"
              >
                View our work
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
            className="h-[320px] w-full rounded-md"
          />
        </div>
      </Section>

      {/* QUICK LINKS */}
      <Section tone="grey" className="!py-0">
        <div className="flex flex-col gap-6 py-14">
          <h2 className="text-[22px]">Jump to what you need</h2>
          <ul className="flex flex-wrap gap-3">
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="inline-flex rounded-full border border-line bg-white px-5 py-2.5 text-[13px] font-medium text-ink-soft hover:border-brand hover:text-blue"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* POPULAR DESIGNS */}
      <Section>
        <SectionHeading
          title="Our popular designs"
          intro="We offer a wide range of personalised services and printed materials to help you honour, remember and celebrate meaningful moments."
          action={{ href: "/portfolio", label: "View full portfolio →" }}
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {work.map((item) => (
            <li key={item.slug}>
              <Link href="/portfolio" className="group flex flex-col gap-3">
                <ImagePlaceholder
                  caption={`[Photograph — ${item.title.toLowerCase()}]`}
                  className="aspect-[4/3] w-full rounded-md"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                  {CATEGORY_LABEL[item.category]}
                </span>
                <span className="font-display text-lg group-hover:underline">
                  {item.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
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
              <span className="font-display text-[28px] text-brand">
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
          {TESTIMONIALS.map((quote) => (
            <li
              key={quote.attribution}
              className="flex flex-col gap-5 rounded-md border border-line bg-white p-8"
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
              Alongside our studio clients, we design, print and ship funeral and
              wedding stationery internationally — proofs are shared and approved
              online, so distance is never a reason to compromise on the details.
            </p>
            <Link
              href="/quote"
              className="mt-2 w-fit rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-blue-deep"
            >
              Get a quote, wherever you are
            </Link>
          </div>
          <ImagePlaceholder
            caption="[Illustration — world map with pins marking where orders have shipped]"
            className="h-[300px] w-full rounded-md"
          />
        </div>
      </Section>

      {/* FAQ PREVIEW */}
      <Section>
        <SectionHeading
          title="Common questions"
          action={{ href: "/faq", label: "View full FAQ →" }}
        />

        <dl className="divide-y divide-line border-y border-line">
          {FAQS.slice(0, 4).map((faq) => (
            <div key={faq.q} className="grid gap-3 py-7 lg:grid-cols-[1fr_1.4fr]">
              <dt className="font-display text-lg">{faq.q}</dt>
              <dd className="text-[15px] leading-relaxed text-ink-muted">
                {faq.a}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <CtaBand
        title="Tell us what you're planning"
        body="Every project starts as a conversation. Send us the details and we'll come back to you within one working day."
        primary={{ href: "/quote", label: "Request a quote" }}
        secondary={{ href: "/portfolio", label: "Browse our work" }}
      />
    </>
  );
}
