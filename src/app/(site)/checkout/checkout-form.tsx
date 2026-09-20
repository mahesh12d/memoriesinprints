"use client";

import { useActionState, useState } from "react";
import { beginPaymentAction } from "@/lib/payments/checkout";
import { emptyFormState } from "@/lib/auth/form-state";
import { FormMessage, SubmitButton } from "@/components/ui/form";

const LABEL: Record<string, string> = {
  razorpay: "Card, via Razorpay",
  paypal: "PayPal",
};

export function CheckoutForm({
  providers,
}: {
  providers: { name: string; configured: boolean }[];
}) {
  const [state, formAction] = useActionState(
    beginPaymentAction,
    emptyFormState,
  );
  const [provider, setProvider] = useState(providers[0]?.name ?? "razorpay");

  const anyConfigured = providers.some((p) => p.configured);

  return (
    <form action={formAction} className="flex max-w-[520px] flex-col gap-6">
      <FormMessage state={state} />

      {!anyConfigured && (
        <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
          Payments aren&rsquo;t live yet — the studio&rsquo;s payment keys
          haven&rsquo;t been added. You can still place the order and it will be
          recorded as awaiting payment.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[13px] font-semibold text-ink-soft">
          How would you like to pay?
        </legend>

        {providers.map((option) => (
          <label
            key={option.name}
            className={`flex cursor-pointer items-center justify-between gap-4 rounded-md border px-5 py-4 transition-colors ${
              provider === option.name
                ? "border-brand bg-brand-tint"
                : "border-line bg-white hover:border-field-line"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="provider"
                value={option.name}
                checked={provider === option.name}
                onChange={() => setProvider(option.name)}
                className="size-4 accent-[color:var(--color-brand-deep)]"
              />
              <span className="text-sm font-semibold">
                {LABEL[option.name] ?? option.name}
              </span>
            </span>

            {!option.configured && (
              <span className="rounded-full bg-surface-grey px-2.5 py-1 text-[11px] font-bold text-ink-muted">
                Not configured
              </span>
            )}
          </label>
        ))}
      </fieldset>

      <SubmitButton pendingLabel="Placing your order…">
        Place order
      </SubmitButton>

      <p className="text-[12px] leading-relaxed text-ink-quiet">
        Placing the order creates it in your account. You can follow it from
        there, and we&rsquo;ll email you when your proof is ready.
      </p>
    </form>
  );
}
