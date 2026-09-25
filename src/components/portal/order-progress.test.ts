import assert from "node:assert/strict";
import test from "node:test";
import { awaitingOrderForm } from "./order-progress";

test("an order with no form sent is waiting on it", () => {
  assert.equal(awaitingOrderForm("awaiting_proof", null, false), true);
  assert.equal(awaitingOrderForm("awaiting_price", null, false), true);
});

test("a form already sent is never outstanding", () => {
  assert.equal(awaitingOrderForm("awaiting_proof", null, true), false);
});

test("the studio having started means the details arrived another way", () => {
  // A proof is with the customer, so nobody should be asked for the form.
  assert.equal(awaitingOrderForm("awaiting_proof", "awaiting_customer", false), false);
  // And neither should a job that is printed, shipped or delivered.
  assert.equal(awaitingOrderForm("in_production", null, false), false);
  assert.equal(awaitingOrderForm("delivered", null, false), false);
  assert.equal(awaitingOrderForm("cancelled", null, false), false);
});
