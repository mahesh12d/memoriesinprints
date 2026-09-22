import assert from "node:assert/strict";
import test from "node:test";
import { canSeeAllOrders, canSeeMoney, canUploadProofs } from "./capabilities";

/**
 * These four answers are the whole access model for the studio floor. They are
 * asserted rather than eyeballed because a quiet `true` in the wrong row shows
 * a designer another customer's invoice.
 */

test("only the office sees money", () => {
  assert.equal(canSeeMoney("designer"), false);
  assert.equal(canSeeMoney("proofreader"), false);
  assert.equal(canSeeMoney("customer"), true);
  assert.equal(canSeeMoney("admin"), true);
});

test("only a designer or admin can replace artwork", () => {
  assert.equal(canUploadProofs("designer"), true);
  assert.equal(canUploadProofs("admin"), true);
  assert.equal(canUploadProofs("proofreader"), false);
  assert.equal(canUploadProofs("customer"), false);
});

test("a designer is scoped to their own orders, everyone else routes work", () => {
  assert.equal(canSeeAllOrders("designer"), false);
  assert.equal(canSeeAllOrders("proofreader"), true);
  assert.equal(canSeeAllOrders("admin"), true);
});
