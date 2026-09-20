"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildProductKey } from "@/lib/pricing/keys";
import { formatMoney, QUOTED_INDIVIDUALLY } from "@/lib/pricing/money";
import { addToCartAction } from "@/lib/cart/actions";

export type SizeOption = {
  id: string;
  label: string;
  dimensions: string | null;
  /** The public list price, rendered on the server with the page. */
  basePrice: { amountMinor: number; currency: string } | null;
};

type CustomerPrice = {
  amountMinor: number;
  currency: string;
  isCustomerPrice: boolean;
} | null;

export function ProductPurchase({
  slug,
  sizes,
  minimumQuantity,
}: {
  slug: string;
  sizes: SizeOption[];
  minimumQuantity: number;
}) {
  const [sizeLabel, setSizeLabel] = useState(sizes[0]?.label ?? "");
  const [quantity, setQuantity] = useState(minimumQuantity);
  // Keyed by item key, so switching back to a size already looked up shows
  // its price immediately and nothing is cleared mid-render.
  const [customerPrices, setCustomerPrices] = useState<
    Record<string, CustomerPrice>
  >({});
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const router = useRouter();

  const selected = sizes.find((size) => size.label === sizeLabel) ?? sizes[0];
  const itemKey = selected ? buildProductKey(slug, selected.label, 1) : "";

  /**
   * The page ships with the public price already rendered. Once it's running,
   * ask whether this viewer has a negotiated rate for the selected size — and
   * ask again every time the size changes, because pricing is per size, never
   * per product.
   */
  useEffect(() => {
    if (!itemKey) return;

    if (itemKey in customerPrices) return;

    let cancelled = false;

    fetch("/api/pricing/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: [itemKey] }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const price = data.prices?.[itemKey] ?? null;
        setCustomerPrices((previous) => ({
          ...previous,
          [itemKey]: price?.isCustomerPrice ? price : null,
        }));
      })
      .catch(() => {
        // A failed lookup just leaves the public price showing.
      });

    return () => {
      cancelled = true;
    };
    // customerPrices is read as a cache guard; re-running on every cache
    // write would defeat the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const customerPrice = customerPrices[itemKey] ?? null;
  const shown = customerPrice ?? selected?.basePrice ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-[30px] leading-none">
            {shown ? formatMoney(shown.amountMinor, shown.currency) : QUOTED_INDIVIDUALLY}
          </span>
          {shown && (
            <span className="text-[13px] text-ink-muted">per piece</span>
          )}
        </div>

        {customerPrice ? (
          <span className="w-fit rounded-full bg-good-tint px-2.5 py-1 text-[11px] font-bold text-good-deep">
            Your price
          </span>
        ) : shown ? null : (
          <span className="text-[13px] text-ink-muted">
            Tell us what you need and we&rsquo;ll price it for you.
          </span>
        )}
      </div>

      {sizes.length > 0 && (
        <div className="flex flex-col gap-3">
          <label
            htmlFor="size"
            className="text-[13px] font-semibold text-ink-soft"
          >
            Size
          </label>
          <select
            id="size"
            value={sizeLabel}
            onChange={(event) => {
              setSizeLabel(event.target.value);
              setAdded(false);
            }}
            className="w-full max-w-[320px] rounded-[3px] border border-field-line bg-white px-[15px] py-[13px] text-sm"
          >
            {sizes.map((size) => (
              <option key={size.id} value={size.label}>
                {size.label}
                {size.dimensions ? ` (${size.dimensions})` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <label
          htmlFor="quantity"
          className="text-[13px] font-semibold text-ink-soft"
        >
          Quantity
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(event) => {
            setQuantity(Math.max(1, Number(event.target.value) || 1));
            setAdded(false);
          }}
          className="w-[140px] rounded-[3px] border border-field-line bg-white px-[15px] py-[13px] text-sm"
        />
        <p className="text-[12px] text-ink-quiet">
          Minimum order {minimumQuantity}.
        </p>
      </div>

      {shown ? (
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
          <p className="text-[12px] text-ink-quiet">
            {formatMoney(shown.amountMinor * quantity, shown.currency)} for{" "}
            {quantity}
          </p>

          {added && (
            <p
              role="status"
              className="rounded-[4px] bg-good-tint px-[14px] py-3 text-[13px] font-semibold text-good-deep"
            >
              Added to your cart.{" "}
              <Link href="/cart" className="underline">
                View cart
              </Link>
            </p>
          )}
        </form>
      ) : (
        <a
          href={`/quote?product=${slug}`}
          className="w-fit rounded-[2px] bg-brand px-7 py-3.5 text-sm font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
        >
          Request a quote for this
        </a>
      )}
    </div>
  );
}
