import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import {
  stubOrderId,
  type CreatedProviderOrder,
  type PaymentProvider,
  type VerificationResult,
} from "./provider";

const API = "https://api.razorpay.com/v1";

function credentials() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
  };
}

export const razorpay: PaymentProvider = {
  name: "razorpay",

  isConfigured() {
    const { keyId, keySecret } = credentials();
    return Boolean(keyId && keySecret);
  },

  publicKey() {
    return credentials().keyId ?? null;
  },

  async createOrder({ orderReference, amountMinor, currency }) {
    const { keyId, keySecret } = credentials();

    if (!keyId || !keySecret) {
      return {
        provider: "razorpay",
        providerOrderId: stubOrderId("razorpay", orderReference),
        amountMinor,
        currency,
        publicKey: null,
        isStub: true,
      } satisfies CreatedProviderOrder;
    }

    // Razorpay takes the amount in the currency's minor unit, which is how it
    // is stored, so no conversion is needed here.
    const response = await fetch(`${API}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: amountMinor,
        currency: currency.toUpperCase(),
        receipt: orderReference,
        notes: { reference: orderReference },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Razorpay rejected the order: ${response.status} ${detail}`);
    }

    const data = (await response.json()) as { id: string };

    return {
      provider: "razorpay",
      providerOrderId: data.id,
      amountMinor,
      currency,
      publicKey: keyId,
      isStub: false,
    };
  },

  /**
   * Razorpay signs the callback with HMAC-SHA256 over "<order_id>|<payment_id>"
   * using the key secret. An unsigned or mismatched callback is treated as a
   * failure — the browser's word alone is never enough to mark an order paid.
   */
  async verify(payload): Promise<VerificationResult> {
    const { keySecret } = credentials();

    const orderId = String(payload.razorpay_order_id ?? "");
    const paymentId = String(payload.razorpay_payment_id ?? "");
    const signature = String(payload.razorpay_signature ?? "");

    if (!keySecret) {
      return {
        ok: false,
        providerPaymentId: null,
        reason: "Razorpay is not configured",
      };
    }

    if (!orderId || !paymentId || !signature) {
      return { ok: false, providerPaymentId: null, reason: "Incomplete callback" };
    }

    const expected = createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    const matches = a.length === b.length && timingSafeEqual(a, b);

    return matches
      ? { ok: true, providerPaymentId: paymentId }
      : { ok: false, providerPaymentId: null, reason: "Signature mismatch" };
  },
};
