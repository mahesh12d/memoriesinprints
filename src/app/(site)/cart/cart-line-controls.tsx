"use client";

import { useTransition } from "react";
import { removeFromCartAction, setQuantityAction } from "@/lib/cart/actions";

export function CartLineControls({
  itemKey,
  quantity,
}: {
  itemKey: string;
  quantity: number;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-4">
      <form
        action={(formData) => startTransition(() => setQuantityAction(formData))}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="itemKey" value={itemKey} />
        <label htmlFor={`qty-${itemKey}`} className="sr-only">
          Quantity
        </label>
        <input
          id={`qty-${itemKey}`}
          name="quantity"
          type="number"
          min={1}
          defaultValue={quantity}
          disabled={pending}
          className="w-[84px] rounded-[3px] border border-field-line bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="text-[13px] font-semibold text-accent-text hover:underline disabled:opacity-60"
        >
          Update
        </button>
      </form>

      <form
        action={(formData) =>
          startTransition(() => removeFromCartAction(formData))
        }
      >
        <input type="hidden" name="itemKey" value={itemKey} />
        <button
          type="submit"
          disabled={pending}
          className="text-[13px] font-semibold text-ink-quiet hover:text-alert disabled:opacity-60"
        >
          Remove
        </button>
      </form>
    </div>
  );
}
