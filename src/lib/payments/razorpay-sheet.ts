import type { PaymentIntent } from "./intent";

/**
 * Razorpay's own checkout overlay, opened from the browser.
 *
 * The card number is typed into Razorpay's window, not into any field this
 * app renders — which is the whole reason the payment page has no card
 * fields, and what keeps this codebase out of PCI scope.
 *
 * What comes back is a signature over "<order_id>|<payment_id>", which the
 * server checks against the key secret before an order is marked paid. The
 * browser saying "it worked" is never enough on its own.
 */

const SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open(): void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/**
 * Loads checkout.js once.
 *
 * Kept as a promise on the module rather than a flag, so two quick clicks
 * wait on the same load instead of starting a second one.
 */
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();

  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Let a later attempt try again rather than failing for the session.
      loading = null;
      reject(new Error("Razorpay's payment window could not be loaded."));
    };
    document.head.appendChild(script);
  });

  return loading;
}

export async function openRazorpaySheet(
  intent: PaymentIntent,
  handlers: {
    onPaid(response: RazorpayResponse): void;
    onDismiss(): void;
    onFailed(message: string): void;
  },
): Promise<void> {
  await loadScript();

  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Razorpay's payment window is unavailable.");

  const sheet = new Razorpay({
    key: intent.publicKey,
    order_id: intent.providerOrderId,
    amount: intent.amountMinor,
    currency: intent.currency,
    name: "Memories in Prints",
    description: `Order ${intent.orderReference}`,
    prefill: { name: intent.customerName, email: intent.customerEmail },
    // Deliberately muted: this is a bereavement purchase, not a checkout to
    // be excited about.
    theme: { color: "#2dbc9a" },
    handler: handlers.onPaid,
    // Closing the window is not a failure — the attempt stays open and the
    // same one reopens next time.
    modal: { ondismiss: handlers.onDismiss },
  });

  /*
    A card that is declined, or a 3-D Secure check that is failed, comes back
    here rather than through the handler. It leaves the order unpaid and the
    attempt open, which is exactly right — they can try another card.
  */
  const withEvents = sheet as RazorpayInstance & {
    on?(event: string, callback: (payload: unknown) => void): void;
  };

  withEvents.on?.("payment.failed", (payload) => {
    const description = (payload as { error?: { description?: string } })?.error
      ?.description;
    handlers.onFailed(
      description ?? "That payment didn't go through. Nothing has been taken.",
    );
  });

  sheet.open();
}
