import type { Metadata } from "next";
import Link from "next/link";
import { getCartContents } from "@/lib/cart/cart";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { Section } from "@/components/site/section";
import { CartLineControls } from "./cart-line-controls";

export const metadata: Metadata = {
  title: "Your cart",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const cart = await getCartContents();

  if (cart.lines.length === 0) {
    return (
      <Section>
        <div className="mx-auto flex max-w-[52ch] flex-col items-center gap-5 py-12 text-center">
          <h1 className="text-[34px] leading-tight">Your cart is empty</h1>
          <p className="text-[15px] leading-relaxed text-ink-muted">
            Anything you add will wait here. If what you need is bespoke, ask us
            for a quote instead and we&rsquo;ll price it properly.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link
              href="/products"
              className="rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
            >
              Browse products
            </Link>
            <Link
              href="/quote"
              className="rounded-[2px] border border-field-line px-7 py-3.5 text-sm font-semibold text-ink-soft hover:bg-surface-grey"
            >
              Request a quote
            </Link>
          </div>
        </div>
      </Section>
    );
  }

  const canCheckout =
    !cart.hasUnpricedItems && !cart.isMixedCurrency && cart.totals.length === 1;

  return (
    <Section>
      <h1 className="mb-10 text-[34px] leading-tight">Your cart</h1>

      <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr]">
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {cart.lines.map((line) => (
            <li
              key={line.itemKey}
              className="flex flex-wrap items-start justify-between gap-6 py-6"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-display text-lg">
                  {line.item?.name ?? "Item no longer available"}
                </span>
                {line.item?.kind === "product" && (
                  <span className="text-[13px] text-ink-muted">
                    {line.item.sizeLabel}
                    {line.item.templateNumber
                      ? ` · template ${line.item.templateNumber}`
                      : ""}
                  </span>
                )}
                {line.item?.price?.isCustomerPrice && (
                  <span className="mt-1 w-fit rounded-full bg-good-tint px-2.5 py-1 text-[11px] font-bold text-good-deep">
                    Your price
                  </span>
                )}
                {!line.item?.price && (
                  <span className="mt-1 text-[13px] text-pending-deep">
                    {QUOTED_INDIVIDUALLY} — ask us and we&rsquo;ll price it.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6">
                <CartLineControls
                  itemKey={line.itemKey}
                  quantity={line.quantity}
                />
                <span className="w-[110px] text-right text-sm font-semibold">
                  {line.lineTotalMinor !== null && line.currency
                    ? formatMoney(line.lineTotalMinor, line.currency)
                    : "—"}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <aside className="flex h-fit flex-col gap-5 rounded-md border border-line bg-card p-7">
          <h2 className="font-display text-lg">Summary</h2>

          <dl className="flex flex-col gap-3">
            {cart.totals.map((total) => (
              <div
                key={total.currency}
                className="flex items-baseline justify-between"
              >
                <dt className="text-[14px] text-ink-muted">
                  Total{cart.totals.length > 1 ? ` (${total.currency})` : ""}
                </dt>
                <dd className="font-display text-[22px]">
                  {formatMoney(total.amountMinor, total.currency)}
                </dd>
              </div>
            ))}
          </dl>

          {cart.isMixedCurrency && (
            <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
              This cart has prices in more than one currency, which can&rsquo;t
              be paid in a single transaction. Remove one of them, or ask us to
              quote the whole thing together.
            </p>
          )}

          {cart.hasUnpricedItems && (
            <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
              Something here is priced individually. Send it as a quote request
              and we&rsquo;ll come back to you within one working day.
            </p>
          )}

          {canCheckout ? (
            <Link
              href="/checkout"
              className="rounded-[2px] bg-brand px-7 py-3.5 text-center text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
            >
              Checkout
            </Link>
          ) : (
            <Link
              href="/quote"
              className="rounded-[2px] bg-brand px-7 py-3.5 text-center text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
            >
              Request a quote instead
            </Link>
          )}

          <p className="text-[12px] leading-relaxed text-ink-quiet">
            A proof always comes to you for approval before anything is printed.
          </p>
        </aside>
      </div>
    </Section>
  );
}
