import assert from "node:assert/strict";
import test from "node:test";
import { buildProductKey, isProductKey, parseItemKey } from "./keys";
import {
  formatMoney,
  majorToMinor,
  minorToMajor,
  minorUnitExponent,
} from "./money";

/* -------------------------------------------------------------------------- */
/* Item keys                                                                  */
/* -------------------------------------------------------------------------- */

test("a composite key is read as a catalogue product", () => {
  const parsed = parseItemKey("order-of-service::A5 booklet::3");

  assert.deepEqual(parsed, {
    kind: "product",
    slug: "order-of-service",
    size: "A5 booklet",
    templateNumber: 3,
    raw: "order-of-service::A5 booklet::3",
  });
});

test("a bare uuid is read as a portfolio piece", () => {
  const id = "7f3c1b2a-4d5e-4f60-8a91-0b2c3d4e5f60";
  const parsed = parseItemKey(id);

  assert.equal(parsed?.kind, "portfolio");
  assert.equal(
    parsed?.kind === "portfolio" ? parsed.portfolioItemId : null,
    id,
  );
});

test("the separator decides the path, not the shape of the rest", () => {
  // A uuid that carries a separator is still a product key.
  assert.equal(
    isProductKey("7f3c1b2a-4d5e-4f60-8a91-0b2c3d4e5f60::A6::1"),
    true,
  );
  assert.equal(isProductKey("7f3c1b2a-4d5e-4f60-8a91-0b2c3d4e5f60"), false);
});

test("sizes containing spaces and punctuation survive a round trip", () => {
  const key = buildProductKey("wedding-invitation-suite", "Square 148mm", 2);
  const parsed = parseItemKey(key);

  assert.equal(parsed?.kind === "product" && parsed.size, "Square 148mm");
  assert.equal(parsed?.kind === "product" && parsed.templateNumber, 2);
});

test("a missing or nonsense template number falls back to the first", () => {
  for (const key of [
    "order-of-service::A6::",
    "order-of-service::A6::abc",
    "order-of-service::A6::0",
    "order-of-service::A6::-4",
  ]) {
    const parsed = parseItemKey(key);
    assert.equal(
      parsed?.kind === "product" && parsed.templateNumber,
      1,
      `${key} should fall back to template 1`,
    );
  }
});

test("malformed keys are rejected rather than guessed at", () => {
  for (const key of [
    "",
    "   ",
    "not-a-uuid",
    "only-one::part",
    "too::many::parts::here",
    "::A6::1",
    "slug::::1",
  ]) {
    assert.equal(parseItemKey(key), null, `${JSON.stringify(key)} should fail`);
  }
});

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

test("minor units follow the currency, not a hardcoded 100", () => {
  assert.equal(minorUnitExponent("GBP"), 2);
  assert.equal(minorUnitExponent("USD"), 2);
  assert.equal(minorUnitExponent("JPY"), 0, "yen has no minor unit");
});

test("converting between minor and major units round-trips", () => {
  assert.equal(minorToMajor(1850, "GBP"), 18.5);
  assert.equal(majorToMinor(18.5, "GBP"), 1850);

  assert.equal(minorToMajor(1850, "JPY"), 1850);
  assert.equal(majorToMinor(1850, "JPY"), 1850);
});

test("each figure is formatted in the currency it was stored in", () => {
  const gbp = formatMoney(1850, "GBP");
  assert.match(gbp, /£/);
  assert.match(gbp, /18\.50/);

  const jpy = formatMoney(1850, "JPY");
  assert.match(jpy, /1,850/);
  assert.doesNotMatch(jpy, /\./, "yen should not show decimals");
});

test("an unknown currency degrades instead of throwing", () => {
  const output = formatMoney(1850, "ZZZ");
  assert.match(output, /ZZZ/);
  assert.match(output, /18\.50/);
});

test("rounding does not lose a penny on .005 boundaries", () => {
  assert.equal(majorToMinor(0.005, "GBP"), 1);
  assert.equal(majorToMinor(10.115, "GBP"), 1012);
});
