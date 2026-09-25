"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  beginPaymentAction,
  confirmPaymentAction,
} from "@/lib/payments/checkout";
import { openRazorpaySheet } from "@/lib/payments/razorpay-sheet";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import type { BeginPaymentState } from "@/lib/payments/intent";

/**
 * Choosing how to pay.
 *
 * Note what is not here: no card number, no expiry, no CVV.
 *
 * Those fields would have to reach this server to be of any use, and the
 * moment a card number touches it the studio is inside the strictest band of
 * PCI DSS — annual on-site assessment, quarterly scans, the lot — for a
 * business selling order of service booklets. Razorpay and PayPal already
 * collect the card on their own pages and hand back a signed result, which is
 * what confirmPaymentAction verifies. Picking a provider here and letting them
 * take the details is both safer and less work.
 */

const LABEL: Record<string, { name: string; hint: string }> = {
  razorpay: { name: "Card", hint: "Visa, Mastercard, Amex" },
  paypal: { name: "PayPal", hint: "Pay with your PayPal account" },
};

function Mark({ provider }: { provider: string }) {
  if (provider === "paypal") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="currentColor">
        <path d="M7.1 21.3H3.8a.6.6 0 0 1-.6-.7L6 3.4a.8.8 0 0 1 .8-.7h6.4c3 0 5 1.5 4.6 4.6-.5 3.5-2.9 5-6 5H9.4a.8.8 0 0 0-.8.7l-.7 7.6a.8.8 0 0 1-.8.7Z" />
        <path
          d="M10.6 22.6H8.2a.5.5 0 0 1-.5-.6l1.4-8.6a.7.7 0 0 1 .7-.6h2.5c2.7 0 4.6-1.3 5-4 .4-2.6-1-3.8-3.4-3.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          opacity="0.55"
        />
      </svg>
    );
  }

  // A card, for the provider that opens a card sheet.
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19" />
      <path d="M6 14.5h3.5" strokeLinecap="round" />
    </svg>
  );
}

export function PayForm({
  orderId,
  amount,
  providers,
}: {
  orderId: string;
  /** Already formatted, so the button can say what it will take. */
  amount: string;
  providers: { name: string; configured: boolean }[];
}) {
  const [state, formAction] = useActionState<BeginPaymentState, FormData>(
    beginPaymentAction,
    { ok: false },
  );
  const [provider, setProvider] = useState(providers[0]?.name ?? "razorpay");
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const router = useRouter();

  const anyConfigured = providers.some((option) => option.configured);

  /**
   * The action hands back an intent; this opens the window it describes.
   *
   * Opening a popup is a side effect of a server round trip, which is the one
   * place an effect is the right tool — it cannot happen during render, and
   * the action itself has no access to the browser.
   *
   * Guarded on the provider order id so React's double-invoked effects in
   * development, or a re-render while the sheet is up, cannot open it twice.
   */
  const opened = useRef<string | null>(null);
  const intent = state.intent;

  useEffect(() => {
    if (!intent) return;
    if (opened.current === intent.providerOrderId) return;
    opened.current = intent.providerOrderId;

    setSheetError(null);

    void openRazorpaySheet(intent, {
      onPaid(response) {
        setSettling(true);
        void confirmPaymentAction(orderId, "razorpay", { ...response }).then(
          (result) => {
            if (result.ok) {
              // The order page is what says "paid", and it reads the row this
              // just wrote rather than anything the browser is holding.
              router.replace(`/checkout/${orderId}`);
              router.refresh();
              return;
            }

            setSettling(false);
            setSheetError(result.message);
          },
        );
      },
      onDismiss() {
        // Closing the window is not a failure. The attempt stays open and the
        // same one is reopened next time, so nothing is duplicated.
        opened.current = null;
      },
      onFailed(message) {
        opened.current = null;
        setSheetError(message);
      },
    }).catch((error: unknown) => {
      opened.current = null;
      setSheetError(
        error instanceof Error
          ? error.message
          : "The payment window could not be opened.",
      );
    });
  }, [intent, orderId, router]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />

      {settling && (
        <p
          role="status"
          className="rounded-[4px] bg-good-tint px-[14px] py-3 text-[13px] font-medium text-good-deep"
        >
          Payment taken — confirming it with your order…
        </p>
      )}

      {sheetError && (
        <p
          role="alert"
          className="rounded-[4px] bg-alert-tint px-[14px] py-3 text-[13px] font-medium text-alert"
        >
          {sheetError}
        </p>
      )}

      {!anyConfigured && (
        <p className="rounded-[4px] bg-pending-tint px-[14px] py-3 text-[13px] leading-relaxed text-pending-deep">
          Payments aren&rsquo;t live yet — the studio&rsquo;s payment keys
          haven&rsquo;t been added. Your order stays as awaiting payment and
          nothing is lost.
        </p>
      )}

      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">How would you like to pay?</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          {providers.map((option) => {
            const chosen = provider === option.name;
            const meta = LABEL[option.name] ?? {
              name: option.name,
              hint: "",
            };

            return (
              <label
                key={option.name}
                className={`flex cursor-pointer flex-col gap-2 rounded-md border p-5 transition-colors ${
                  chosen
                    ? "border-brand bg-brand-tint"
                    : "border-line bg-card hover:border-field-line"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span
                    className={chosen ? "text-brand-deep" : "text-ink-soft"}
                  >
                    <Mark provider={option.name} />
                  </span>
                  <input
                    type="radio"
                    name="provider"
                    value={option.name}
                    checked={chosen}
                    onChange={() => setProvider(option.name)}
                    className="size-4 accent-[color:var(--color-brand-deep)]"
                  />
                </span>

                <span className="text-sm font-semibold">{meta.name}</span>
                <span className="text-[12px] leading-relaxed text-ink-quiet">
                  {option.configured
                    ? meta.hint
                    : "Not set up on this site yet"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Opening payment…">Pay {amount}</SubmitButton>

      {/*
        Said plainly, because the next thing that happens is a window they did
        not design opening and asking for a card number — which is exactly the
        moment a careful person stops and wonders whether they should.
      */}
      <p className="text-[12px] leading-relaxed text-ink-quiet">
        {provider === "paypal" ? "PayPal" : "Razorpay"} opens its own secure
        window over this page to take your card. The details are typed into
        theirs, never into ours, and we only ever see whether the payment
        succeeded.
      </p>
    </form>
  );
}
