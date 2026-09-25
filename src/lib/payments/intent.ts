/**
 * What the browser needs to open a payment sheet.
 *
 * Its own module because it crosses the boundary: `checkout.ts` is a
 * "use server" file, which may only export async functions, and the client
 * component that opens the sheet has to name this shape too.
 *
 * Nothing secret is in here. The key is the publishable one, and the order id
 * is the provider's own — neither is enough to move money on its own, and
 * whether a payment happened is decided by the signature the provider returns
 * afterwards, never by anything in this object.
 */
export type PaymentIntent = {
  provider: "razorpay";
  publicKey: string;
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  orderReference: string;
  /** Prefilled into the sheet so the customer is not retyping what we know. */
  customerName: string;
  customerEmail: string;
};

/**
 * What `beginPaymentAction` hands back to the form.
 *
 * The usual form state, plus the sheet to open when there is one. A stub or a
 * provider with no client integration still redirects, so `intent` being
 * absent is not a failure.
 */
export type BeginPaymentState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  intent?: PaymentIntent;
};
