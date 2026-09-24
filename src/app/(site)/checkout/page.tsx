import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCartContents } from "@/lib/cart/cart";
import { getSession } from "@/lib/auth/session";
import { formatMoney } from "@/lib/pricing/money";
import { Section } from "@/components/site/section";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const session = await getSession("site");
  if (!session) redirect("/login?next=%2Fcheckout");

  const cart = await getCartContents();

  if (
    cart.lines.length === 0 ||
    cart.hasUnpricedItems ||
    cart.isMixedCurrency ||
    cart.totals.length !== 1
  ) {
    redirect("/cart");
  }

  const total = cart.totals[0];

  return (
    <Section>
      <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-8">
          <div className="flex max-w-[52ch] flex-col gap-3">
            <h1 className="text-[34px] leading-tight">Checkout</h1>
            <p className="text-[15px] leading-relaxed text-ink-muted">
              Nothing is printed until you&rsquo;ve seen and approved a proof.
              You&rsquo;ll get one in your account as soon as the studio has
              made it.
            </p>
          </div>

          <CheckoutForm />
        </div>

        {/*
          What is being ordered comes first on a phone.

          Stacked, the summary would otherwise sit under the whole form, so
          the first thing on the screen at checkout would be a question rather
          than the thing being paid for. Side by side from lg, it goes back to
          the right where it belongs.
        */}
        <aside className="-order-1 flex h-fit flex-col gap-5 rounded-md border border-line bg-card p-7 lg:order-none">
          <h2 className="font-display text-lg">Your order</h2>

          <ul className="flex flex-col divide-y divide-line-soft border-y border-line-soft">
            {cart.lines.map((line) => (
              <li
                key={line.itemKey}
                className="flex items-start justify-between gap-4 py-3.5"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">
                    {line.item?.name}
                  </span>
                  <span className="text-[12px] text-ink-quiet">
                    {line.item?.sizeLabel ? `${line.item.sizeLabel} · ` : ""}
                    {line.quantity} ×
                  </span>
                </span>
                <span className="text-[14px] font-semibold">
                  {line.lineTotalMinor !== null && line.currency
                    ? formatMoney(line.lineTotalMinor, line.currency)
                    : "—"}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between">
            <span className="text-[14px] text-ink-muted">Total</span>
            <span className="font-display text-[24px]">
              {formatMoney(total.amountMinor, total.currency)}
            </span>
          </div>

          <Link
            href="/cart"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Back to cart
          </Link>
        </aside>
      </div>
    </Section>
  );
}
