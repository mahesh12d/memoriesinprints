import "server-only";

/**
 * One shape for both providers, so checkout doesn't branch on who's taking the
 * money. Each implementation creates an order with the provider and returns
 * the id the client SDK needs to open the payment sheet.
 *
 * Neither provider has credentials yet. Until the studio adds them, both fall
 * back to a stub that is clearly labelled in the UI and never claims a real
 * payment took place.
 */
export type ProviderName = "razorpay" | "paypal";

export type CreatedProviderOrder = {
  provider: ProviderName;
  /** The provider's own id for this attempt, stored against the payment. */
  providerOrderId: string;
  amountMinor: number;
  currency: string;
  /** Publishable key or client id, safe to hand to the browser. */
  publicKey: string | null;
  /** True when no credentials are configured and this is a stand-in. */
  isStub: boolean;
};

export type VerificationResult = {
  ok: boolean;
  providerPaymentId: string | null;
  reason?: string;
};

export interface PaymentProvider {
  readonly name: ProviderName;
  isConfigured(): boolean;
  /**
   * The publishable key, or null when the provider has no credentials.
   *
   * Needed on its own so an attempt that is already open with the provider
   * can be reopened without creating a second one just to learn the key.
   */
  publicKey(): string | null;
  createOrder(input: {
    orderReference: string;
    amountMinor: number;
    currency: string;
  }): Promise<CreatedProviderOrder>;
  verify(payload: Record<string, unknown>): Promise<VerificationResult>;
}

export function stubOrderId(provider: ProviderName, reference: string): string {
  return `stub_${provider}_${reference}_${Date.now().toString(36)}`;
}
