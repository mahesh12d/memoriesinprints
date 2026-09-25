import assert from "node:assert/strict";
import test from "node:test";
import { groupFor, sortQueue, type QueueItem, type Viewer } from "./queue";
import { clampPin, numberPins, pinFromClick } from "./pins";

const PROOFREADER: Viewer = { id: "reader-1", role: "proofreader" };
const DESIGNER: Viewer = { id: "designer-1", role: "designer" };

function item(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    orderId: "order-1",
    reference: "MP-1001",
    proofStatus: "awaiting_proofreading",
    assignedDesignerId: "designer-1",
    waitingSince: new Date("2026-09-01T09:00:00Z"),
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Queue grouping                                                             */
/* -------------------------------------------------------------------------- */

test("a proof waiting to be checked belongs to the proofreader", () => {
  assert.equal(
    groupFor(item({ proofStatus: "awaiting_proofreading" }), PROOFREADER),
    "awaiting_you",
  );
});

test("the same proof is not the designer's problem while it's being checked", () => {
  assert.equal(
    groupFor(item({ proofStatus: "awaiting_proofreading" }), DESIGNER),
    "awaiting_customer",
  );
});

test("work returned to the designer lands on the designer", () => {
  assert.equal(
    groupFor(item({ proofStatus: "returned_to_designer" }), DESIGNER),
    "awaiting_you",
  );
  assert.equal(
    groupFor(item({ proofStatus: "returned_to_designer" }), PROOFREADER),
    "needs_work",
  );
});

test("changes requested by the customer go back to the designer", () => {
  assert.equal(
    groupFor(item({ proofStatus: "changes_requested" }), DESIGNER),
    "awaiting_you",
  );
});

test("an order with nothing uploaded yet is the designer's to start", () => {
  assert.equal(
    groupFor(item({ proofStatus: null }), DESIGNER),
    "awaiting_you",
  );
});

test("another designer's returned work isn't yours", () => {
  assert.equal(
    groupFor(
      item({ proofStatus: "returned_to_designer", assignedDesignerId: "someone-else" }),
      DESIGNER,
    ),
    "needs_work",
  );
});

test("a proof with the customer is nobody's to act on", () => {
  for (const viewer of [PROOFREADER, DESIGNER]) {
    assert.equal(
      groupFor(item({ proofStatus: "awaiting_customer" }), viewer),
      "awaiting_customer",
    );
  }
});

test("approved work drops to the bottom", () => {
  assert.equal(groupFor(item({ proofStatus: "approved" }), PROOFREADER), "done");
});

/* -------------------------------------------------------------------------- */
/* Queue ordering                                                             */
/* -------------------------------------------------------------------------- */

test("what you should act on comes first, oldest waiting first within it", () => {
  const groups = sortQueue(
    [
      item({
        reference: "NEWEST-YOURS",
        proofStatus: "awaiting_proofreading",
        waitingSince: new Date("2026-09-10T09:00:00Z"),
      }),
      item({
        reference: "WITH-CUSTOMER",
        proofStatus: "awaiting_customer",
        waitingSince: new Date("2026-08-01T09:00:00Z"),
      }),
      item({
        reference: "OLDEST-YOURS",
        proofStatus: "awaiting_proofreading",
        waitingSince: new Date("2026-09-02T09:00:00Z"),
      }),
    ],
    PROOFREADER,
  );

  assert.equal(groups[0].group, "awaiting_you");
  assert.deepEqual(
    groups[0].items.map((i) => i.reference),
    ["OLDEST-YOURS", "NEWEST-YOURS"],
    "the piece that has waited longest should be first",
  );

  // An older item in a later group still doesn't jump the queue.
  assert.equal(groups.at(-1)?.group, "awaiting_customer");
});

test("empty groups are left out rather than shown as headings", () => {
  const groups = sortQueue(
    [item({ proofStatus: "awaiting_proofreading" })],
    PROOFREADER,
  );
  assert.equal(groups.length, 1);
});

/* -------------------------------------------------------------------------- */
/* Comment pins                                                               */
/* -------------------------------------------------------------------------- */

test("a click becomes a percentage of the artwork", () => {
  const pin = pinFromClick(
    { clientX: 150, clientY: 100 },
    { left: 100, top: 50, width: 200, height: 200 },
  );

  assert.deepEqual(pin, { xPct: 25, yPct: 25 });
});

test("a pin never sits so close to the edge that its marker is cut off", () => {
  const topLeft = pinFromClick(
    { clientX: 0, clientY: 0 },
    { left: 0, top: 0, width: 400, height: 400 },
  );
  assert.ok(topLeft!.xPct >= 1.5 && topLeft!.yPct >= 1.5);

  const bottomRight = pinFromClick(
    { clientX: 400, clientY: 400 },
    { left: 0, top: 0, width: 400, height: 400 },
  );
  assert.ok(bottomRight!.xPct <= 98.5 && bottomRight!.yPct <= 98.5);
});

test("a click outside the artwork is pulled back onto it", () => {
  const pin = pinFromClick(
    { clientX: -50, clientY: 900 },
    { left: 0, top: 0, width: 400, height: 400 },
  );
  assert.deepEqual(pin, clampPin(-12.5, 225));
});

test("a zero-sized container yields no pin rather than dividing by zero", () => {
  assert.equal(
    pinFromClick(
      { clientX: 10, clientY: 10 },
      { left: 0, top: 0, width: 0, height: 0 },
    ),
    null,
  );
});

test("pins are numbered in the order they were left", () => {
  const numbered = numberPins([
    { body: "second", createdAt: new Date("2026-09-02T10:00:00Z") },
    { body: "first", createdAt: new Date("2026-09-01T10:00:00Z") },
    { body: "third", createdAt: new Date("2026-09-03T10:00:00Z") },
  ]);

  assert.deepEqual(
    numbered.map((c) => [c.pinNumber, c.body]),
    [
      [1, "first"],
      [2, "second"],
      [3, "third"],
    ],
  );
});

/* -------------------------------------------------------------------------- */
/* A draft belongs to whoever uploaded it                                     */
/* -------------------------------------------------------------------------- */

test("a draft waits on its designer, not on the proofreader", () => {
  const draft = item({ proofStatus: "draft" });

  assert.equal(groupFor(draft, DESIGNER), "awaiting_you");
  // Not in the proofreader's pile: it has not been handed to them yet.
  assert.notEqual(groupFor(draft, PROOFREADER), "awaiting_you");
});

test("sending it on moves it to the proofreader", () => {
  const sent = item({ proofStatus: "awaiting_proofreading" });

  assert.equal(groupFor(sent, PROOFREADER), "awaiting_you");
  assert.notEqual(groupFor(sent, DESIGNER), "awaiting_you");
});
