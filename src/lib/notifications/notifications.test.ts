import assert from "node:assert/strict";
import test from "node:test";
import { bundle, bundleNote, foldActivity } from "./bundle";
import { agingLevel, jumpsQueue, waitedFor } from "./aging";
import type { NotificationRow } from "./types";

const AT = new Date("2026-09-20T12:00:00Z");

function minutesBefore(minutes: number): Date {
  return new Date(AT.getTime() - minutes * 60_000);
}

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "n-1",
    title: "Something happened",
    body: null,
    linkUrl: "/staff/orders/order-1",
    orderId: "order-1",
    createdAt: AT,
    isUnread: true,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/* Bundling                                                                   */
/* -------------------------------------------------------------------------- */

test("a burst on one order folds into a single line", () => {
  const groups = bundle([
    row({ id: "a", createdAt: minutesBefore(0) }),
    row({ id: "b", createdAt: minutesBefore(2) }),
    row({ id: "c", createdAt: minutesBefore(5) }),
  ]);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].count, 3);
  assert.deepEqual(groups[0].ids, ["a", "b", "c"]);
});

test("the newest wording leads, because it is what just happened", () => {
  const groups = bundle([
    row({ id: "a", title: "Version 3 sent", createdAt: minutesBefore(0) }),
    row({ id: "b", title: "Version 2 sent", createdAt: minutesBefore(4) }),
  ]);

  assert.equal(groups[0].title, "Version 3 sent");
});

test("events far apart stay separate, even on the same order", () => {
  const groups = bundle([
    row({ id: "a", createdAt: minutesBefore(0) }),
    // Well outside the half-hour window.
    row({ id: "b", createdAt: minutesBefore(200) }),
  ]);

  assert.equal(groups.length, 2);
});

test("different orders never fold together", () => {
  const groups = bundle([
    row({ id: "a", orderId: "order-1", createdAt: minutesBefore(0) }),
    row({ id: "b", orderId: "order-2", createdAt: minutesBefore(1) }),
  ]);

  assert.equal(groups.length, 2);
});

test("a bundle does not reach back across other news to collect a straggler", () => {
  const groups = bundle([
    row({ id: "a", orderId: "order-1", createdAt: minutesBefore(0) }),
    row({ id: "b", orderId: "order-2", createdAt: minutesBefore(1) }),
    row({ id: "c", orderId: "order-1", createdAt: minutesBefore(2) }),
  ]);

  assert.equal(groups.length, 3, "what is between two events is part of the news");
});

test("rows with no order are each their own line", () => {
  const groups = bundle([
    row({ id: "a", orderId: null, createdAt: minutesBefore(0) }),
    row({ id: "b", orderId: null, createdAt: minutesBefore(1) }),
  ]);

  assert.equal(groups.length, 2);
});

test("a folded line is unread if any row in it is", () => {
  const groups = bundle([
    row({ id: "a", isUnread: false, createdAt: minutesBefore(0) }),
    row({ id: "b", isUnread: true, createdAt: minutesBefore(1) }),
  ]);

  assert.equal(groups[0].isUnread, true, "clearing it would clear an unread row");
});

test("a single line admits to nothing folded", () => {
  const [single] = bundle([row()]);
  assert.equal(bundleNote(single), null);

  const [folded] = bundle([
    row({ id: "a", createdAt: minutesBefore(0) }),
    row({ id: "b", createdAt: minutesBefore(1) }),
    row({ id: "c", createdAt: minutesBefore(2) }),
  ]);
  assert.equal(bundleNote(folded), "and 2 more updates");
});

test("the activity feed folds on the same rule as the panel", () => {
  const folded = foldActivity(
    [
      { id: "a", orderId: "order-1", summary: "Page 1", createdAt: minutesBefore(0) },
      { id: "b", orderId: "order-1", summary: "Page 2", createdAt: minutesBefore(3) },
      { id: "c", orderId: "order-2", summary: "Elsewhere", createdAt: minutesBefore(4) },
    ],
    new Set(["order-2"]),
  );

  assert.equal(folded.length, 2);
  assert.equal(folded[0].folded, 1);
  assert.equal(folded[0].unseen, false);
  assert.equal(folded[1].unseen, true, "order-2 has activity they have not seen");
});

/* -------------------------------------------------------------------------- */
/* Aging                                                                      */
/* -------------------------------------------------------------------------- */

test("age crosses from calm to amber at four hours", () => {
  assert.equal(agingLevel(minutesBefore(239), AT), "fresh");
  assert.equal(agingLevel(minutesBefore(240), AT), "warm");
});

test("age crosses from amber to red at a day", () => {
  assert.equal(agingLevel(minutesBefore(24 * 60 - 1), AT), "warm");
  assert.equal(agingLevel(minutesBefore(24 * 60), AT), "overdue");
});

test("only the overdue jump their bucket", () => {
  assert.equal(jumpsQueue("fresh"), false);
  assert.equal(jumpsQueue("warm"), false);
  assert.equal(jumpsQueue("overdue"), true);
});

test("how long it waited reads in the shortest true form", () => {
  assert.equal(waitedFor(minutesBefore(0), AT), "just now");
  assert.equal(waitedFor(minutesBefore(5), AT), "5m");
  assert.equal(waitedFor(minutesBefore(90), AT), "1h");
  assert.equal(waitedFor(minutesBefore(24 * 60), AT), "1 day");
  assert.equal(waitedFor(minutesBefore(3 * 24 * 60), AT), "3 days");
});

test("a future timestamp never reads as negative", () => {
  const later = new Date(AT.getTime() + 60_000);
  assert.equal(waitedFor(later, AT), "just now");
});
