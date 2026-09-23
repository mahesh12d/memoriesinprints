import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./webhook-signature";

/**
 * This function is the whole of the webhook's security. If it ever returned
 * true for an unsigned body, anyone who found the URL could mark their own
 * order paid — and nothing else in the app would look wrong. So these assert
 * both directions, and every way it can be handed nothing.
 */

const SECRET = "whsec_test_value";
const BODY = JSON.stringify({ event: "payment.captured", payload: {} });

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

test("accepts a body signed with the webhook secret", () => {
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), SECRET), true);
});

test("rejects a body that was altered after signing", () => {
  const signature = sign(BODY);
  const tampered = JSON.stringify({ event: "payment.captured", payload: { x: 1 } });

  assert.equal(verifyWebhookSignature(tampered, signature, SECRET), false);
});

test("rejects a signature made with a different secret", () => {
  assert.equal(
    verifyWebhookSignature(BODY, sign(BODY, "someone-elses-secret"), SECRET),
    false,
  );
});

test("rejects when the signature header is missing", () => {
  assert.equal(verifyWebhookSignature(BODY, "", SECRET), false);
});

test("rejects everything when the secret is not configured", () => {
  // The dangerous failure would be treating "no secret" as "no checking".
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), undefined), false);
  assert.equal(verifyWebhookSignature(BODY, sign(BODY), ""), false);
});

test("rejects a signature of the wrong length without throwing", () => {
  // timingSafeEqual throws on mismatched lengths; that must not become a 500.
  assert.equal(verifyWebhookSignature(BODY, "abc123", SECRET), false);
  assert.equal(verifyWebhookSignature(BODY, sign(BODY) + "00", SECRET), false);
});

test("the signature covers the exact bytes, not the parsed object", () => {
  // Re-serialising reorders keys and drops whitespace. If the route ever
  // signed JSON.stringify(JSON.parse(raw)) instead of raw, real deliveries
  // would start failing — this records why the route uses request.text().
  const spaced = '{"event": "payment.captured"}';
  const compact = '{"event":"payment.captured"}';

  assert.equal(verifyWebhookSignature(spaced, sign(spaced), SECRET), true);
  assert.equal(verifyWebhookSignature(compact, sign(spaced), SECRET), false);
});
