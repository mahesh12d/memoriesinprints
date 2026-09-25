import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { STUDIO } from "@/lib/studio";
import { Breadcrumb, Section } from "@/components/site/section";
import { QuoteForm } from "@/app/(site)/quote/quote-form";

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Get in touch with Memories in Prints studio. Send us a message or request a quote for funeral, wedding, or bespoke celebration stationery.",
};

/** The whole journey, not just the first day of it. */
const NEXT_STEPS: { title: string; body: string }[] = [
  {
    title: "Send your enquiry",
    body: "We\u2019ll get back to you within 30 minutes.",
  },
  {
    title: "Sign in & track your order",
    body: "View your proofs, orders and updates in your account.",
  },
  {
    title: "Fill in the order form",
    body: "Provide the deceased details, specifications and timing for your order.",
  },
  {
    title: "Proofing",
    body: "We\u2019ll prepare your design and send it to you for review.",
  },
  {
    title: "Request any changes",
    body: "Let us know if you\u2019d like anything changed before approval.",
  },
  {
    title: "Approve & pay",
    body: "Once you\u2019re happy, approve your order and make payment.",
  },
  {
    title: "Digital order",
    body: "Your final digital files will be sent to you by email.",
  },
  {
    title: "Print & deliver",
    body: "Your printed order will be delivered directly to your address. Tracking details will be provided if required.",
  },
];

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productSlug } = await searchParams;
  const session = await getSession("site");

  // Prefill from the product the visitor came from, if specified
  const product = productSlug
    ? (
      await db
        .select({ name: products.name, category: products.category })
        .from(products)
        .where(eq(products.slug, productSlug))
        .limit(1)
    )[0]
    : undefined;

  // Prefill contact details if the user is already signed in
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
      <Breadcrumb
        trail={[{ href: "/", label: "Home" }, { label: "Contact us" }]}
      />

      <div className="grid gap-14 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-[62ch] flex-col gap-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-text">
              Get in touch
            </span>
            <h1 className="text-[40px] leading-tight">Contact Us</h1>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Have a question about our stationery, want to discuss a custom design,
              or need a written quote? Send us the details below and our studio will
              come back to you within one working day. Nothing is committed or charged
              until you&rsquo;ve approved your quote and digital proofs.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-card p-8 shadow-xs">
            <div className="mb-6">
              <h2 className="font-display text-2xl font-medium">Request a Quote / Send an Enquiry</h2>
              <p className="mt-1 text-[13px] text-ink-quiet">
                Fill in the details below and we will prepare a personalised quotation.
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
        </div>

        <aside className="flex flex-col gap-6">
          {/* Direct studio contact */}
          <div className="rounded-xl border border-line bg-card p-7 shadow-xs">
            <h2 className="font-display text-xl font-medium">Prefer to Talk?</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
              You can call or email our studio directly to discuss urgent timings or bespoke design requirements.
            </p>

            <div className="mt-5 flex flex-col gap-4 border-t border-line pt-5 text-[14px]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-quiet">
                  Email
                </span>
                <p className="mt-0.5 font-medium text-ink-soft">
                  <a
                    href={`mailto:${STUDIO.email}`}
                    className="hover:text-blue hover:underline"
                  >
                    {STUDIO.email}
                  </a>
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-ink-quiet">
                  Studio Hours
                </span>
                <p className="mt-0.5 text-ink-muted">{STUDIO.openingHours}</p>
              </div>

            </div>
          </div>

          {/* Urgent Orders notice */}
          <div className="rounded-xl border border-brand/30 bg-brand-tint/60 p-6">
            <h3 className="font-display text-base font-semibold text-brand-deep">
              Urgent Funeral Orders
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-on-accent">
              Need an order of service or memorial stationery turned around within 48 hours? Call us directly and we&rsquo;ll prioritise your proofing and printing.
            </p>
          </div>

          {/* What happens next */}
          <div className="rounded-xl border border-line bg-card p-7 shadow-xs">
            <h2 className="font-display text-xl font-medium">What Happens Next</h2>
            <ol className="mt-5 flex flex-col gap-4">
              {NEXT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11px] font-bold text-accent-text">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[14px] font-semibold leading-snug">
                      {step.title}
                    </span>
                    <span className="text-[13px] leading-relaxed text-ink-muted">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </Section>
  );
}
