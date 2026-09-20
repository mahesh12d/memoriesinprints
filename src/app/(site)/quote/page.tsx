import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { STUDIO } from "@/lib/studio";
import { Section } from "@/components/site/section";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = {
  title: "Request a quote",
  description:
    "Tell us about your project and we'll come back to you within one working day.",
};

const NEXT_STEPS = [
  "We read your enquiry within one working day.",
  "We call or email to confirm the details and timing.",
  "You receive a written quote to review and approve.",
];

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productSlug } = await searchParams;
  const session = await getSession("site");

  // Prefill from the product the visitor came from, if there was one.
  const product = productSlug
    ? (
        await db
          .select({ name: products.name, category: products.category })
          .from(products)
          .where(eq(products.slug, productSlug))
          .limit(1)
      )[0]
    : undefined;

  // Prefill contact details for someone already signed in.
  const profile = session
    ? (
        await db
          .select({
            name: users.name,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1)
      )[0]
    : undefined;

  return (
    <Section>
      <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-[58ch] flex-col gap-4">
            <h1 className="text-[40px] leading-tight">Request a quote</h1>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Tell us about your project and we&rsquo;ll come back to you within
              one working day — sooner if it&rsquo;s urgent. Nothing is charged
              until you&rsquo;ve seen and approved a written quote.
            </p>
          </div>

          <QuoteForm
            defaults={{
              name: profile?.name ?? "",
              email: profile?.email ?? "",
              phone: profile?.phone ?? "",
              category: product?.category ?? "funeral",
              subject: product ? `${product.name} enquiry` : "",
            }}
          />
        </div>

        <aside className="flex flex-col gap-8">
          <div className="rounded-md border border-line bg-white p-7">
            <h2 className="font-display text-lg">What happens next</h2>
            <ol className="mt-4 flex flex-col gap-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11px] font-bold text-accent-text">
                    {index + 1}
                  </span>
                  <span className="text-[14px] leading-relaxed text-ink-muted">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-md border border-line bg-white p-7">
            <h2 className="font-display text-lg">Prefer to talk?</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              {STUDIO.phone}
              <br />
              {STUDIO.email}
            </p>
            <p className="mt-3 text-[13px] text-ink-quiet">
              {STUDIO.openingHours}
            </p>
          </div>
        </aside>
      </div>
    </Section>
  );
}
