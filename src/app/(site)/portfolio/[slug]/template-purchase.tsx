"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/lib/cart/actions";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";

/**
 * Ordering a design from the portfolio.
 *
 * The quantity control is a stepper *and* a text field. Funeral stationery is
 * ordered by the head count of a service, so someone arrives knowing they need
 * 140 — making them press + a hundred and forty times would be absurd, and a
 * bare text field is awkward for the person nudging 40 to 45. Both, then.
 */
export function TemplatePurchase({
  itemKey,
  price,
  quoteHref,
}: {
  itemKey: string;
  price: { amountMinor: number; currency: string } | null;
  quoteHref: string;
}) {
  /*
    Starts at one, not at a guessed run length. A quantity that arrives
    pre-filled reads as the studio's minimum order rather than a suggestion,
    and someone who wanted a single keepsake had to notice and correct it.
  */
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const step = (by: number) => {
    setQuantity((current) => Math.min(9999, Math.max(1, current + by)));
    setAdded(false);
  };

  if (!price) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-display text-[26px] leading-none">
          {QUOTED_INDIVIDUALLY}
        </p>
        <p className="max-w-[46ch] text-[14px] leading-relaxed text-ink-muted">
          This one is priced around what you need — the paper, the finish and
          how many. Tell us and we&rsquo;ll come back within a working day.
        </p>
        <Link
          href={quoteHref}
          className="w-fit rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
        >
          Ask for a price
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <span className="font-display text-[30px] leading-none">
          {formatMoney(price.amountMinor, price.currency)}
        </span>
        <span className="text-[13px] text-ink-muted">per piece</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <label
          htmlFor="quantity"
          className="text-[13px] font-semibold text-ink-soft"
        >
          How many do you need?
        </label>

        <div className="flex w-fit items-center rounded-full border border-field-line bg-card">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={quantity <= 1}
            className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:text-blue disabled:opacity-40"
          >
            <span className="sr-only">One fewer</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <input
            id="quantity"
            type="number"
            min={1}
            max={9999}
            value={quantity}
            onChange={(event) => {
              setQuantity(Math.min(9999, Math.max(1, Number(event.target.value) || 1)));
              setAdded(false);
            }}
            className="w-16 border-0 bg-transparent text-center text-[15px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            type="button"
            onClick={() => step(1)}
            disabled={quantity >= 9999}
            className="flex size-11 items-center justify-center rounded-full text-ink-soft hover:text-blue disabled:opacity-40"
          >
            <span className="sr-only">One more</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <form
        action={(formData) =>
          startTransition(async () => {
            await addToCartAction(formData);
            setAdded(true);
            // Refresh so the cart count in the header keeps up.
            router.refresh();
          })
        }
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="itemKey" value={itemKey} />
        <input type="hidden" name="quantity" value={quantity} />

        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add to cart"}
        </button>

        <p className="text-[13px] text-ink-muted">
          {formatMoney(price.amountMinor * quantity, price.currency)} for{" "}
          {quantity}
        </p>

        {added && (
          <p
            role="status"
            className="w-fit rounded-[4px] bg-good-tint px-[14px] py-3 text-[13px] font-semibold text-good-deep"
          >
            Added to your cart.{" "}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}
