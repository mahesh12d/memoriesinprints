import "server-only";

import { minorToMajor } from "@/lib/pricing/money";
import {
  stubOrderId,
  type PaymentProvider,
  type VerificationResult,
} from "./provider";

function credentials() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: process.env.PAYPAL_CLIENT_SECRET ?? "",
    /** Sandbox unless explicitly switched to live. */
    base:
      process.env.PAYPAL_ENV === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com",
  };
}

async function accessToken(): Promise<string> {
  const { clientId, clientSecret, base } = credentials();

  const response = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal refused the token request: ${response.status}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

export const paypal: PaymentProvider = {
  name: "paypal",

  isConfigured() {
    const { clientId, clientSecret } = credentials();
    return Boolean(clientId && clientSecret);
  },

  publicKey() {
    return credentials().clientId ?? null;
  },

  async createOrder({ orderReference, amountMinor, currency }) {
    const { clientId, base } = credentials();

    if (!this.isConfigured()) {
      return {
        provider: "paypal",
        providerOrderId: stubOrderId("paypal", orderReference),
        amountMinor,
        currency,
        publicKey: null,
        isStub: true,
      };
    }

    // PayPal wants the amount as a decimal string in major units, unlike
    // Razorpay, which is why the conversion lives here and not at the caller.
    const value = minorToMajor(amountMinor, currency).toFixed(
      currency.toUpperCase() === "JPY" ? 0 : 2,
    );

    const response = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderReference,
            amount: { currency_code: currency.toUpperCase(), value },
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`PayPal rejected the order: ${response.status} ${detail}`);
    }

    const data = (await response.json()) as { id: string };

    return {
      provider: "paypal",
      providerOrderId: data.id,
      amountMinor,
      currency,
      publicKey: clientId,
      isStub: false,
    };
  },

  /**
   * The browser reports that the payer approved; this asks PayPal to capture
   * and only trusts a COMPLETED response from PayPal itself.
   */
  async verify(payload): Promise<VerificationResult> {
    const { base } = credentials();
    const orderId = String(payload.paypalOrderId ?? "");

    if (!this.isConfigured()) {
      return {
        ok: false,
        providerPaymentId: null,
        reason: "PayPal is not configured",
      };
    }

    if (!orderId) {
      return { ok: false, providerPaymentId: null, reason: "Missing order id" };
    }

    const response = await fetch(`${base}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        providerPaymentId: null,
        reason: `Capture failed: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      id: string;
      status: string;
    };

    return data.status === "COMPLETED"
      ? { ok: true, providerPaymentId: data.id }
      : {
          ok: false,
          providerPaymentId: data.id ?? null,
          reason: `Unexpected status ${data.status}`,
        };
  },
};
