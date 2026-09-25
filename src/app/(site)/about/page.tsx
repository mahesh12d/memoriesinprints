import type { Metadata } from "next";
import { STUDIO_VALUES } from "@/content/home";
import { STUDIO } from "@/lib/studio";
import { Breadcrumb, Section, SectionHeading } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "An independent UK print studio handling funeral and wedding stationery with the same attention to detail.",
};

export default function AboutPage() {
  return (
    <>
      <Section>
        <Breadcrumb
          trail={[{ href: "/", label: "Home" }, { label: "About Us" }]}
        />

        <div className="flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">
            A Studio Run with Care
          </h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Memories in Prints is an independent print studio handling funeral
            and wedding stationery with the same attention to detail — whether
            that&rsquo;s six memorial cards or six hundred invitations.
          </p>
        </div>
      </Section>

      <Section tone="white">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
              Our story
            </span>
            <h2 className="text-[32px] leading-tight">Why We Started</h2>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Memories in Prints began with a simple frustration: funeral
              stationery that felt like an afterthought, and wedding stationery
              that took weeks to turn around. We set out to build a studio that
              could do both properly — proofed by hand, printed to a standard
              you&rsquo;d expect from a dedicated stationer, and delivered to
              the timeline a family or a couple actually needs, not the
              printer&rsquo;s.
            </p>
          </div>
          <ImagePlaceholder
            caption="[Photograph — founder reviewing a printed proof at the workbench]"
            fileName="about-founder-proof.webp"
            className="h-[340px] w-full rounded-md"
          />
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <ImagePlaceholder
            caption="[Photograph — the studio's founder at the workbench, folding a printed booklet]"
            fileName="about-founder-folding.webp"
            className="order-last h-[340px] w-full rounded-md lg:order-first"
          />
          <div className="flex flex-col gap-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
              Meet the studio
            </span>
            <h2 className="text-[32px] leading-tight">
              The People Behind the Design &amp; Print
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Every proof that leaves the studio is designed, checked and
              finished by hand — not passed through a call centre. When you call
              or email, you&rsquo;re speaking to the person actually making your
              stationery. {STUDIO.founderName} founded Memories in Prints in{" "}
              {STUDIO.foundedYear}, and leads every project personally alongside
              a small studio team.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="blue">
        <SectionHeading
          tone="light"
          eyebrow="What we stand by"
          title="Where Craft Meets Care"
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

      <Section tone="grey">
        <div className="mx-auto flex max-w-[64ch] flex-col items-center gap-5 text-center">
          <span className="rounded-full bg-good-tint px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-good-deep">
            FSA Member — Funeral Service Association
          </span>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Memories in Prints is a proud member of the Funeral Service
            Association, meeting their standards of care, professionalism and
            reliability for the families and funeral directors we work with.
          </p>
        </div>
      </Section>
    </>
  );
}
