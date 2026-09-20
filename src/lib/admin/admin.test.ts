import assert from "node:assert/strict";
import { test } from "node:test";
import { describe, ORDER_STATUS, slugify, uniqueSlug } from "./labels";
import { canChangeRole, canDisable, type UserRole } from "./user-rules";

/* -------------------------------------------------------------------------- */
/* Slugs                                                                      */
/* -------------------------------------------------------------------------- */

test("slugify turns a product name into an address", () => {
  assert.equal(slugify("Order of Service Booklet"), "order-of-service-booklet");
  assert.equal(slugify("  Trimmed  "), "trimmed");
});

test("slugify folds accents rather than dropping the letters", () => {
  assert.equal(slugify("Bébé"), "bebe");
  assert.equal(slugify("Åsa & Jürgen"), "asa-jurgen");
});

test("slugify leaves nothing but letters, numbers and single hyphens", () => {
  assert.equal(slugify("A5 — 'Silk' (170gsm)!"), "a5-silk-170gsm");
  assert.equal(slugify("***"), "");
});

test("slugify caps the length so a long name can't make an unusable URL", () => {
  assert.ok(slugify("word ".repeat(60)).length <= 80);
});

test("uniqueSlug leaves a free slug alone", () => {
  assert.equal(uniqueSlug("memory-box", ["order-of-service"]), "memory-box");
});

test("uniqueSlug counts up past the ones already taken", () => {
  assert.equal(
    uniqueSlug("memory-box", ["memory-box", "memory-box-2"]),
    "memory-box-3",
  );
});

/* -------------------------------------------------------------------------- */
/* Labels                                                                     */
/* -------------------------------------------------------------------------- */

test("describe falls back to the raw value rather than a blank cell", () => {
  assert.deepEqual(describe(ORDER_STATUS, "shipped"), {
    label: "Shipped",
    tone: "good",
  });
  assert.deepEqual(describe(ORDER_STATUS, "something_new"), {
    label: "something_new",
    tone: "neutral",
  });
});

/* -------------------------------------------------------------------------- */
/* Who may change whose role                                                  */
/* -------------------------------------------------------------------------- */

const ADMIN = "admin-1";
const OTHER = "admin-2";

function roleChange(over: Partial<Parameters<typeof canChangeRole>[0]> = {}) {
  return canChangeRole({
    targetId: "user-1",
    currentRole: "customer" as UserRole,
    nextRole: "designer" as UserRole,
    actorId: ADMIN,
    adminCount: 2,
    ...over,
  });
}

test("an ordinary promotion is allowed", () => {
  assert.deepEqual(roleChange(), { allowed: true });
});

test("setting the role someone already has is refused", () => {
  const verdict = roleChange({ currentRole: "designer", nextRole: "designer" });
  assert.equal(verdict.allowed, false);
});

test("an admin can't remove their own admin access", () => {
  const verdict = roleChange({
    targetId: ADMIN,
    currentRole: "admin",
    nextRole: "designer",
    adminCount: 5,
  });

  assert.equal(verdict.allowed, false);
  assert.match(
    verdict.allowed === false ? verdict.reason : "",
    /your own administrator access/i,
  );
});

test("the last administrator can't be demoted, even by someone else", () => {
  const verdict = roleChange({
    targetId: OTHER,
    currentRole: "admin",
    nextRole: "customer",
    adminCount: 1,
  });

  assert.equal(verdict.allowed, false);
  assert.match(
    verdict.allowed === false ? verdict.reason : "",
    /only administrator/i,
  );
});

test("one of several administrators can be demoted", () => {
  assert.deepEqual(
    roleChange({
      targetId: OTHER,
      currentRole: "admin",
      nextRole: "customer",
      adminCount: 3,
    }),
    { allowed: true },
  );
});

test("promoting to admin is never blocked by the admin count", () => {
  assert.deepEqual(
    roleChange({ currentRole: "customer", nextRole: "admin", adminCount: 1 }),
    { allowed: true },
  );
});

/* -------------------------------------------------------------------------- */
/* Suspending accounts                                                        */
/* -------------------------------------------------------------------------- */

function disableChange(over: Partial<Parameters<typeof canDisable>[0]> = {}) {
  return canDisable({
    targetId: "user-1",
    targetRole: "customer" as UserRole,
    actorId: ADMIN,
    adminCount: 2,
    disable: true,
    ...over,
  });
}

test("suspending an ordinary account is allowed", () => {
  assert.deepEqual(disableChange(), { allowed: true });
});

test("nobody can suspend themselves", () => {
  const verdict = disableChange({ targetId: ADMIN });
  assert.equal(verdict.allowed, false);
});

test("the last administrator can't be suspended", () => {
  const verdict = disableChange({
    targetId: OTHER,
    targetRole: "admin",
    adminCount: 1,
  });
  assert.equal(verdict.allowed, false);
});

test("restoring is always allowed, even for yourself", () => {
  assert.deepEqual(
    disableChange({ targetId: ADMIN, disable: false }),
    { allowed: true },
  );
});
