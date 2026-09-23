"use client";

import { useActionState } from "react";
import { placeOrderAction } from "@/lib/payments/checkout";
import { emptyFormState } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/form";

/**
 * No payment method is chosen here any more.
 *
 * Placing the order starts the proof; payment is asked for once the customer
 * has approved what they are paying for. Choosing a card at this point would
 * imply they were about to be charged.
 */
export function CheckoutForm() {
  const [state, formAction] = useActionState(placeOrderAction, emptyFormState);

  return (
    <form action={formAction} className="flex max-w-[520px] flex-col gap-5">
      <FormMessage state={state} />

      {/*
        Optional, and said to be optional. Funeral directors order for a
        family and need their own list to be readable; a family ordering for
        themselves has no use for this and should not feel asked.
      */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="orderedFor" className="text-[13px] font-semibold text-ink-soft">
          Who is this order for?{" "}
          <span className="font-normal text-ink-quiet">(optional)</span>
        </label>
        <input
          id="orderedFor"
          name="orderedFor"
          type="text"
          maxLength={200}
          autoComplete="off"
          className="rounded-[3px] border border-field-line bg-card px-3 py-2.5 text-sm"
        />
        <p className="text-[12px] leading-relaxed text-ink-quiet">
          A name to recognise this order by in your account — useful if you
          place orders on behalf of families.
        </p>
      </div>

      <SubmitButton pendingLabel="Placing your order…">
        Place order
      </SubmitButton>

      <p className="text-[12px] leading-relaxed text-ink-quiet">
        Nothing is charged today. We&rsquo;ll prepare your proof and email you
        when it&rsquo;s ready — you only pay once you&rsquo;ve approved it.
      </p>
    </form>
  );
}
