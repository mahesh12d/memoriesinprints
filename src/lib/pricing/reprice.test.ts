import assert from "node:assert/strict";
import test from "node:test";
import { planReprice, type RepriceableOrder } from "./reprice-rules";
import type { ResolvedItem } from "./resolve-types";

const KEY = "order-of-service::A5 booklet::1";

function priced(amountMinor: number, currency = "GBP"): Map<string, ResolvedItem> {
  return new Map([
    [
      KEY,
      {
        key: KEY,
        kind: "product",
        name: "Order of service",
        price: { amountMinor, currency, isCustomerPrice: false },
      } satisfies ResolvedItem,
    ],
  ]);
}

function order(overrides: Partial<RepriceableOrder> = {}): RepriceableOrder {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    paymentStatus: "unpaid",
    totalMinor: 1000,
    currency: "GBP",
    items: [{ itemKey: KEY, quantity: 1 }],
    ...overrides,
  };
}

test("a changed catalogue price is written back", () => {
  const plan = planReprice(order(), priced(1850));
  assert.deepEqual(plan, { action: "update", totalMinor: 1850, currency: "GBP" });
});

test("a paid order is never repriced, even when the catalogue moved", () => {
  const plan = planReprice(
    order({ paymentStatus: "paid", totalMinor: 1000 }),
    priced(9999),
  );
  assert.equal(plan.action, "skip");
  assert.equal(plan.action === "skip" && plan.reason, "already paid");
});

test("an order with no items is skipped", () => {
  const plan = planReprice(order({ items: [] }), priced(1850));
  assert.equal(plan.action, "skip");
  assert.equal(plan.action === "skip" && plan.reason, "no items");
});

test("an order with more than one item is skipped", () => {
  const plan = planReprice(
    order({ items: [{ itemKey: KEY, quantity: 1 }, { itemKey: KEY, quantity: 2 }] }),
    priced(1850),
  );
  assert.equal(plan.action, "skip");
  assert.equal(plan.action === "skip" && plan.reason, "more than one item");
});

test("an unchanged figure is not written", () => {
  const plan = planReprice(order({ totalMinor: 1850 }), priced(1850));
  assert.equal(plan.action, "unchanged");
});

test("quantity multiplies the unit price", () => {
  const plan = planReprice(
    order({ items: [{ itemKey: KEY, quantity: 80 }], totalMinor: 0 }),
    priced(150),
  );
  assert.deepEqual(plan, {
    action: "update",
    totalMinor: 12000,
    currency: "GBP",
  });
});

test("an item with no price leaves the order alone rather than zeroing it", () => {
  const unpriced: Map<string, ResolvedItem> = new Map([
    [KEY, { key: KEY, kind: "product", name: "Order of service", price: null }],
  ]);

  const plan = planReprice(order({ totalMinor: 1850 }), unpriced);
  assert.equal(plan.action, "skip");
  assert.equal(plan.action === "skip" && plan.reason, "quoted individually");
});

test("an item that has vanished from the catalogue is skipped", () => {
  const plan = planReprice(order(), new Map());
  assert.equal(plan.action, "skip");
  assert.equal(plan.action === "skip" && plan.reason, "item not found");
});

test("a line with no key is skipped", () => {
  const plan = planReprice(
    order({ items: [{ itemKey: null, quantity: 1 }] }),
    priced(1850),
  );
  assert.equal(plan.action, "skip");
});

test("a currency change alone is enough to trigger a write", () => {
  const plan = planReprice(
    order({ totalMinor: 1850, currency: "GBP" }),
    priced(1850, "EUR"),
  );
  assert.deepEqual(plan, {
    action: "update",
    totalMinor: 1850,
    currency: "EUR",
  });
});

test("an order that has never been priced gets one", () => {
  const plan = planReprice(order({ totalMinor: null }), priced(1850));
  assert.deepEqual(plan, { action: "update", totalMinor: 1850, currency: "GBP" });
});
