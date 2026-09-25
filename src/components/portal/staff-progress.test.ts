import assert from "node:assert/strict";
import test from "node:test";
import { stage } from "./staff-progress";

/**
 * The proof cycle loops. A proofreader can send artwork back and a customer
 * can ask for changes, and both put the job back with the designer — but for
 * different reasons and different work. If those ever collapsed into one
 * message, or the line stopped rewinding, the board would quietly show jobs as
 * further along than they are.
 */

const ASSIGNED = 0;
const ARTWORK = 1;
const CHECKED = 2;
const CUSTOMER = 3;
const APPROVED = 4;
const PRINTED = 5;

test("an unassigned order sits at the first step", () => {
  const s = stage("awaiting_proof", null, false, false);
  assert.equal(s.current, ASSIGNED);
  assert.match(s.note, /not yet assigned/i);
});

test("assigned but nothing uploaded waits on the designer", () => {
  const s = stage("awaiting_proof", null, true, false);
  assert.equal(s.current, ARTWORK);
  assert.match(s.note, /designer/i);
});

test("a fresh upload is with the proofreader, not in production", () => {
  // The whole point of the uploadProofAction fix: uploading is not printing.
  const s = stage("awaiting_proof", "awaiting_proofreading", true, true);
  assert.equal(s.current, CHECKED);
  assert.match(s.note, /proofreader/i);
});

test("sent to the customer waits on them", () => {
  const s = stage("awaiting_proof", "awaiting_customer", true, true);
  assert.equal(s.current, CUSTOMER);
});

test("the proofreader returning it rewinds to artwork, and says who sent it back", () => {
  const s = stage("awaiting_proof", "returned_to_designer", true, true);
  assert.equal(s.current, ARTWORK, "must rewind, not stay ahead");
  assert.match(s.note, /proofreader/i);
});

test("the customer asking for changes rewinds too, and is told apart from the proofreader", () => {
  const back = stage("awaiting_proof", "changes_requested", true, true);
  const returned = stage("awaiting_proof", "returned_to_designer", true, true);

  assert.equal(back.current, ARTWORK);
  assert.match(back.note, /customer/i);
  assert.notEqual(
    back.note,
    returned.note,
    "the two ways back must not read the same — the work differs",
  );
});

test("approved is ready to print", () => {
  const s = stage("awaiting_proof", "approved", true, true);
  assert.equal(s.current, APPROVED);
});

test("the order's own later stages outrank the proof cycle", () => {
  assert.equal(stage("in_production", "approved", true, true).current, PRINTED);
  assert.equal(stage("shipped", "approved", true, true).current, PRINTED);
  assert.equal(stage("delivered", "approved", true, true).current, 6);
});

test("a cancelled order has no position on the line", () => {
  const s = stage("cancelled", "awaiting_customer", true, true);
  assert.equal(s.current, -1, "-1 tells the component to show no steps at all");
});

test("every stage says something, whatever it is handed", () => {
  const statuses = [
    "awaiting_price", "awaiting_payment", "awaiting_proof",
    "in_production", "shipped", "delivered", "cancelled",
  ] as const;
  const proofs = [
    null, "awaiting_proofreading", "returned_to_designer",
    "awaiting_customer", "approved", "changes_requested",
  ] as const;

  for (const status of statuses) {
    for (const proof of proofs) {
      for (const designer of [true, false]) {
        for (const hasProof of [true, false]) {
          const s = stage(status, proof, designer, hasProof);
          assert.ok(
            s.note.length > 0,
            `${status}/${proof}/${designer}/${hasProof} produced no note`,
          );
          assert.ok(s.current >= -1 && s.current <= 6);
        }
      }
    }
  }
});

test("a draft reads as artwork still in hand, not as checked", () => {
  const draft = stage("awaiting_proof", "draft", true, true);
  const sent = stage("awaiting_proof", "awaiting_proofreading", true, true);

  assert.equal(draft.current, sent.current - 1);
  assert.match(draft.note, /designer is checking it/);
  assert.match(sent.note, /proofreader/);
});
