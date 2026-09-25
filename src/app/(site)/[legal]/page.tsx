import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { STUDIO } from "@/lib/studio";
import { Breadcrumb, Section } from "@/components/site/section";

/**
 * Terms, privacy and cookies are linked from the footer, so they need to exist
 * rather than 404. The text itself has to be written by the studio (and, for
 * privacy, checked against what the site actually collects) — these pages say
 * so honestly instead of shipping boilerplate that would be wrong.
 */
const PAGES = {
  terms: {
    title: "Terms of service",
    intro:
      "The terms covering orders, proofs, cancellation and delivery with Memories in Prints.",
  },
  privacy: {
    title: "Privacy notice",
    intro:
      "What we collect when you enquire or order, why we hold it, how long we keep it and your rights under UK GDPR.",
  },
  cookies: {
    title: "Cookie notice",
    intro: "The cookies this site sets, and what each one is for.",
  },
} as const;

type LegalSlug = keyof typeof PAGES;

function isLegalSlug(value: string): value is LegalSlug {
  return value in PAGES;
}

export function generateStaticParams() {
  return Object.keys(PAGES).map((legal) => ({ legal }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legal: string }>;
}): Promise<Metadata> {
  const { legal } = await params;
  if (!isLegalSlug(legal)) return {};

  return { title: PAGES[legal].title, description: PAGES[legal].intro };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ legal: string }>;
}) {
  const { legal } = await params;
  if (!isLegalSlug(legal)) notFound();

  const page = PAGES[legal];

  return (
    <Section>
      <Breadcrumb
        trail={[{ href: "/", label: "Home" }, { label: page.title }]}
      />

      <div className="flex max-w-[66ch] flex-col gap-5">
        <h1 className="text-[36px] leading-tight">{page.title}</h1>
        <p className="text-[15px] leading-relaxed text-ink-muted">
          {page.intro}
        </p>

        <div className="mt-4 rounded-md border border-pending-deep/25 bg-pending-tint p-6">
          <h2 className="font-display text-lg">Not Yet Written</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            This wording needs to come from the studio, and the privacy notice
            should be checked against what the site actually collects before
            launch. Drafting boilerplate here would risk saying something untrue
            about your business.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
            In the meantime, email {STUDIO.email} with any question about your
            data or an order, and we&rsquo;ll answer directly.
          </p>
        </div>

        <Link href="/" className="mt-4 text-[13px] font-semibold text-accent-text">
          ← Back to the studio
        </Link>
      </div>
    </Section>
  );
}
