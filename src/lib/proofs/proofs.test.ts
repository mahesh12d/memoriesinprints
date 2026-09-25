import assert from "node:assert/strict";
import test from "node:test";
import {
  groupFor,
  reasonFor,
  sortQueue,
  type QueueItem,
  type Viewer,
} from "./queue";
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

/* -------------------------------------------------------------------------- */
/* Role-aware ordering, aging and snooze                                      */
/* -------------------------------------------------------------------------- */

/** A fixed clock, so nothing here depends on when the suite is run. */
const NOW = new Date("2026-09-20T12:00:00Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 3_600_000);
}

test("a designer is shown what came back to them before anything else", () => {
  const groups = sortQueue(
    [
      item({
        reference: "NOT-STARTED",
        proofStatus: null,
        waitingSince: hoursAgo(2),
      }),
      item({
        reference: "SENT-BACK",
        proofStatus: "returned_to_designer",
        waitingSince: hoursAgo(1),
      }),
      item({
        reference: "OWN-DRAFT",
        proofStatus: "draft",
        waitingSince: hoursAgo(3),
      }),
    ],
    DESIGNER,
    { now: NOW },
  );

  assert.deepEqual(
    groups[0].items.map((i) => i.reference),
    ["SENT-BACK", "NOT-STARTED", "OWN-DRAFT"],
    "blocking work first, even though it is the newest of the three",
  );
});

test("a proofreader is shown what is waiting to be checked before anything else", () => {
  const groups = sortQueue(
    [
      item({
        reference: "BACK-FROM-CUSTOMER",
        proofStatus: "changes_requested",
        waitingSince: hoursAgo(1),
      }),
      item({
        reference: "TO-CHECK",
        proofStatus: "awaiting_proofreading",
        waitingSince: hoursAgo(2),
      }),
    ],
    PROOFREADER,
    { now: NOW },
  );

  // Different buckets for a proofreader, so check each one's leader.
  const flat = groups.flatMap((group) => group.items.map((i) => i.reference));
  assert.equal(flat[0], "TO-CHECK");
});

test("the same data sorts differently for the two roles", () => {
  const rows = [
    item({
      reference: "TO-CHECK",
      proofStatus: "awaiting_proofreading",
      waitingSince: hoursAgo(1),
    }),
    item({
      reference: "SENT-BACK",
      proofStatus: "returned_to_designer",
      waitingSince: hoursAgo(2),
    }),
  ];

  const forDesigner = sortQueue(rows, DESIGNER, { now: NOW })
    .flatMap((group) => group.items)
    .map((i) => i.reference);
  const forProofreader = sortQueue(rows, PROOFREADER, { now: NOW })
    .flatMap((group) => group.items)
    .map((i) => i.reference);

  assert.notDeepEqual(
    forDesigner,
    forProofreader,
    "a designer's priorities are not a proofreader's",
  );
});

test("something that has sat for a day is lifted above fresher work", () => {
  const groups = sortQueue(
    [
      item({
        reference: "FRESH-BLOCKER",
        proofStatus: "returned_to_designer",
        waitingSince: hoursAgo(1),
      }),
      item({
        reference: "COLD",
        proofStatus: "draft",
        waitingSince: hoursAgo(30),
      }),
    ],
    DESIGNER,
    { now: NOW },
  );

  assert.equal(
    groups[0].items[0].reference,
    "COLD",
    "a day-old item is somebody's bad day whatever kind of work it is",
  );
});

test("age alone does not reorder everything, only the overdue", () => {
  const groups = sortQueue(
    [
      item({
        reference: "BLOCKER",
        proofStatus: "returned_to_designer",
        waitingSince: hoursAgo(1),
      }),
      item({
        reference: "OLDER-BUT-NOT-OVERDUE",
        proofStatus: "draft",
        waitingSince: hoursAgo(5),
      }),
    ],
    DESIGNER,
    { now: NOW },
  );

  assert.equal(
    groups[0].items[0].reference,
    "BLOCKER",
    "five hours is not overdue, so the role ordering still decides",
  );
});

test("an order set aside drops out of the queue, and can be asked for back", () => {
  const rows = [
    item({
      reference: "SNOOZED",
      proofStatus: "returned_to_designer",
      snoozedUntil: new Date(NOW.getTime() + 3_600_000),
    }),
    item({ reference: "AWAKE", proofStatus: "returned_to_designer" }),
  ];

  const hidden = sortQueue(rows, DESIGNER, { now: NOW })
    .flatMap((group) => group.items)
    .map((i) => i.reference);
  assert.deepEqual(hidden, ["AWAKE"]);

  const shown = sortQueue(rows, DESIGNER, { now: NOW, includeSnoozed: true })
    .flatMap((group) => group.items)
    .map((i) => i.reference);
  assert.equal(shown.length, 2);
});

test("a snooze that has run out stops hiding anything", () => {
  const groups = sortQueue(
    [
      item({
        reference: "WOKEN",
        proofStatus: "returned_to_designer",
        snoozedUntil: new Date(NOW.getTime() - 60_000),
      }),
    ],
    DESIGNER,
    { now: NOW },
  );

  assert.equal(groups[0].items[0].reference, "WOKEN");
});

test("every row can say why it is in front of you", () => {
  for (const status of [
    "changes_requested",
    "returned_to_designer",
    "awaiting_proofreading",
    "awaiting_customer",
    "draft",
    "approved",
    null,
  ]) {
    for (const viewer of [DESIGNER, PROOFREADER]) {
      assert.notEqual(
        reasonFor(item({ proofStatus: status }), viewer),
        "",
        `no reason written for ${status} as ${viewer.role}`,
      );
    }
  }
});
