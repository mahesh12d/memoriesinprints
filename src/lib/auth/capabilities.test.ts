import assert from "node:assert/strict";
import test from "node:test";
import {
  canSeeAllOrders,
  canSeeMoney,
  canUploadProofs,
  mayOpenProof,
} from "./capabilities";

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

test("a designer only reaches proofs on the jobs assigned to them", () => {
  const order = { ownerId: "customer-1", assignedDesignerId: "designer-1" };

  assert.equal(mayOpenProof({ id: "designer-1", role: "designer" }, order), true);
  assert.equal(mayOpenProof({ id: "designer-2", role: "designer" }, order), false);
  // Unassigned work is nobody's until a proofreader routes it.
  assert.equal(
    mayOpenProof(
      { id: "designer-1", role: "designer" },
      { ownerId: "customer-1", assignedDesignerId: null },
    ),
    false,
  );
});

test("the customer, the proofreader and admin always reach it", () => {
  const order = { ownerId: "customer-1", assignedDesignerId: "designer-1" };

  assert.equal(mayOpenProof({ id: "customer-1", role: "customer" }, order), true);
  assert.equal(mayOpenProof({ id: "customer-2", role: "customer" }, order), false);
  assert.equal(mayOpenProof({ id: "p-1", role: "proofreader" }, order), true);
  assert.equal(mayOpenProof({ id: "a-1", role: "admin" }, order), true);
});
