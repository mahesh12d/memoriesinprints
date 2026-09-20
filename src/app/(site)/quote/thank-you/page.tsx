import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { STUDIO } from "@/lib/studio";
import { Section } from "@/components/site/section";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default async function QuoteThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const session = await getSession("site");

  return (
    <Section>
      <div className="mx-auto flex max-w-[60ch] flex-col items-center gap-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-sage-tint text-sage-deep">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>

        <h1 className="text-[34px] leading-tight">Thank you — that&rsquo;s with us</h1>

        {ref && (
          <p className="text-[15px] text-ink-muted">
            Your reference is{" "}
            <strong className="font-semibold text-charcoal">{ref}</strong>. A
            confirmation is on its way to your inbox.
          </p>
        )}

        <p className="max-w-[52ch] text-[15px] leading-relaxed text-ink-muted">
          We read every enquiry ourselves and will come back to you within one
          working day. If your date is close, call the studio on {STUDIO.phone}{" "}
          and we&rsquo;ll pick it up straight away.
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {session ? (
            <Link
              href="/account/quotes"
              className="rounded-[2px] bg-charcoal px-7 py-3.5 text-sm font-semibold text-ivory hover:bg-night"
            >
              See it in my account
            </Link>
          ) : (
            <Link
              href="/signup"
              className="rounded-[2px] bg-charcoal px-7 py-3.5 text-sm font-semibold text-ivory hover:bg-night"
            >
              Create an account to track it
            </Link>
          )}
          <Link
            href="/portfolio"
            className="rounded-[2px] border border-field-line px-7 py-3.5 text-sm font-semibold text-ink-soft hover:bg-line-warm"
          >
            Browse our work
          </Link>
        </div>
      </div>
    </Section>
  );
}
