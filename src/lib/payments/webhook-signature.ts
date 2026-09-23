import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks the signature on a Razorpay webhook delivery.
 *
 * Razorpay signs the raw request body with HMAC-SHA256 using the *webhook*
 * secret — a different secret from the key secret used for the browser
 * callback, set separately when the webhook is created in their dashboard.
 *
 * The body must be the exact bytes received. Parsing the JSON and
 * re-serialising it would reorder keys and drop whitespace, and the signature
 * would never match again.
 *
 * Anyone can POST to a public webhook URL, so this is the only thing standing
 * between a stranger and marking their own order paid. It takes the secret as
 * an argument rather than reading the environment, which keeps it a pure
 * function the tests can actually exercise.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string | undefined,
): boolean {
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");

  // timingSafeEqual throws on a length mismatch, so that is checked first.
  return a.length === b.length && timingSafeEqual(a, b);
}
