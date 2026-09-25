import type { Metadata } from "next";
import { Breadcrumb, CtaBand, Section } from "@/components/site/section";
import { ImagePlaceholder } from "@/components/site/image-placeholder";

export const metadata: Metadata = {
  title: "Corporate Printing",
  description:
    "Business printing from the studio that prints your funeral stationery — one supplier for the lot.",
};

/**
 * Everything the studio prints that is not for a service.
 *
 * Deliberately a list of what it does rather than a catalogue with prices:
 * the ranges, quantities and finishes are still being settled, and a page
 * that invents them would be a page the studio has to honour.
 */
const RANGES = [
  {
    title: "Stationery",
    body: "Letterheads, compliment slips and business cards, on the same stocks as the memorial work.",
  },
  {
    title: "Forms & booklets",
    body: "Arrangement forms, price lists and service booklets, printed in the runs you actually use.",
  },
  {
    title: "Signage & display",
    body: "Foam boards, roller banners and window graphics for the branch and for open days.",
  },
  {
    title: "Folders & presentation",
    body: "Presentation folders and inserts that hold the paperwork a family takes home.",
  },
];

export default function CorporatePrintingPage() {
  return (
    <>
      <Section>
        <Breadcrumb
          trail={[{ href: "/", label: "Home" }, { label: "Corporate Printing" }]}
        />

        <div className="flex max-w-[62ch] flex-col gap-4">
          <h1 className="text-[40px] leading-tight">
            All Business Printing Products
          </h1>
          <p className="text-[17px] leading-relaxed text-ink-soft">
            So you don&rsquo;t have to use multiple suppliers.
          </p>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            The studio already prints the stationery your families take home.
            The same presses, paper and proofing handle everything else the
            business needs printed — quoted together, delivered together.
          </p>
        </div>
      </Section>

      <Section tone="white">
        <ul className="grid gap-8 sm:grid-cols-2">
          {RANGES.map((range) => (
            <li
              key={range.title}
              className="flex flex-col gap-3 rounded-md border border-line bg-card p-7"
            >
              <ImagePlaceholder
                caption={`[Photograph — ${range.title.toLowerCase()}]`}
                fileName={`corporate-${range.title.toLowerCase().replace(/[^a-z]+/g, "-")}.webp`}
                className="aspect-[4/3] w-full rounded-md"
              />
              <h2 className="font-display text-lg">{range.title}</h2>
              <p className="text-[14px] leading-relaxed text-ink-muted">
                {range.body}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title="Don't See What You're Looking For?"
        body="Tell us what you need printed and how many, and we will come back with a price. If it goes through a press, it is worth asking."
        primary={{ href: "/contact", label: "Contact Us" }}
      />
    </>
  );
}
