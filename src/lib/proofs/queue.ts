/**
 * How the studio work queue is ordered, kept free of database imports so the
 * rule can be tested on its own.
 *
 * The spec asks for whatever this viewer should act on next to come first,
 * and oldest-waiting first within that. So the ordering is by group, and by
 * age inside each group — the piece that has been sitting longest is the one
 * most likely to be someone's bad day.
 */

import { agingLevel, jumpsQueue } from "@/lib/notifications/aging";

export type QueueGroup =
  | "awaiting_you"
  | "needs_work"
  | "awaiting_customer"
  | "done";

export type QueueItem = {
  orderId: string;
  reference: string;
  proofStatus: string | null;
  assignedDesignerId: string | null;
  /** When the proof entered its current state. */
  waitingSince: Date;
  /** Set aside by this viewer until then. Absent means it is not. */
  snoozedUntil?: Date | null;
  /** Activity this viewer has not seen. Drives the "new" dot. */
  unseen?: boolean;
};

export type Viewer = {
  id: string;
  role: "designer" | "proofreader" | "admin";
};

/**
 * Which pile an item sits in for this particular viewer. A proofreader's
 * "yours" is a proof waiting to be checked; a designer's is one that came
 * back to them.
 */
export function groupFor(item: QueueItem, viewer: Viewer): QueueGroup {
  const status = item.proofStatus;

  if (status === "approved") return "done";

  if (status === "awaiting_customer") return "awaiting_customer";

  if (viewer.role === "proofreader" || viewer.role === "admin") {
    if (status === "awaiting_proofreading") return "awaiting_you";
    // A draft is not theirs to check yet — the designer still has it.
    if (status === "draft") return "needs_work";
    if (status === "returned_to_designer" || status === "changes_requested") {
      return "needs_work";
    }
    // Nothing uploaded yet: someone still has to draw it.
    return "needs_work";
  }

  // Designers act on work that has come back to them, or that they own and
  // hasn't been drawn yet.
  const isTheirs =
    item.assignedDesignerId === viewer.id || item.assignedDesignerId === null;

  if (
    (status === "returned_to_designer" ||
      status === "changes_requested" ||
      // Their own upload, waiting on them to check it and send it on.
      status === "draft" ||
      status === null) &&
    isTheirs
  ) {
    return "awaiting_you";
  }

  if (status === "awaiting_proofreading") return "awaiting_customer";

  return "needs_work";
}

/**
 * Which of this viewer's own items to put in front of the others.
 *
 * Grouping says whose move it is; this says what to do first once you know it
 * is yours. Same data, different order per role — a designer's blocking work is
 * whatever came back to them, a proofreader's is whatever is waiting to be
 * checked, and neither wants to scan the other's priorities to find theirs.
 *
 * Lower sorts first. Age breaks ties, so within one rank the piece that has
 * sat longest still leads.
 */
export function priorityFor(item: QueueItem, viewer: Viewer): number {
  const status = item.proofStatus;

  if (viewer.role === "designer") {
    // Sent back, by either the proofreader or the customer: somebody is
    // waiting on a correction and nothing else moves until it is made.
    if (status === "returned_to_designer" || status === "changes_requested") {
      return 0;
    }
    // Assigned with nothing drawn yet — the job has not started.
    if (status === null) return 1;
    // Their own upload, waiting on them to check it and send it on.
    if (status === "draft") return 2;
    return 3;
  }

  // Proofreaders and admin route the work as well as check it.
  if (status === "awaiting_proofreading") return 0;
  // Back from the customer: needs reading and putting somewhere.
  if (status === "changes_requested") return 1;
  if (status === "returned_to_designer") return 2;
  if (status === null) return 3;
  return 4;
}

/**
 * The one-line reason a row is in front of someone, in place of a bare status
 * pill.
 *
 * "Changes requested" says what happened to the proof; "the customer marked
 * pages for changes" says why it is your problem. The caller can override this
 * with the real event summary where there is one — this is the fallback for an
 * order whose events predate any of this.
 */
export function reasonFor(item: QueueItem, viewer: Viewer): string {
  const status = item.proofStatus;
  const designer = viewer.role === "designer";

  switch (status) {
    case "changes_requested":
      return designer
        ? "The customer marked pages for changes"
        : "Came back from the customer with changes";
    case "returned_to_designer":
      return designer
        ? "The proofreader sent it back"
        : "Waiting on the designer to fix it";
    case "awaiting_proofreading":
      return designer
        ? "With the proofreader"
        : "A new version is waiting to be checked";
    case "awaiting_customer":
      return "With the customer for approval";
    case "draft":
      return designer
        ? "Your draft — not sent for checking yet"
        : "The designer is still working on it";
    case "approved":
      return "Approved and ready to print";
    case null:
      return designer ? "Nothing drawn yet" : "No proof uploaded yet";
    default:
      return "";
  }
}

const GROUP_ORDER: QueueGroup[] = [
  "awaiting_you",
  "needs_work",
  "awaiting_customer",
  "done",
];

export const GROUP_LABEL: Record<QueueGroup, string> = {
  awaiting_you: "Waiting on you",
  needs_work: "Needs work",
  awaiting_customer: "With the customer",
  done: "Approved",
};

export type SortOptions = {
  /**
   * Passed in so the sort and the badges agree.
   *
   * Aging is read twice — once to order the rows, once to colour them — and
   * two calls to `new Date()` can land either side of a threshold, which shows
   * up as a row lifted to the top of its bucket while still rendering its age
   * in grey.
   */
  now?: Date;
  /**
   * Keep orders the viewer has set aside.
   *
   * The default hides them, which is what a snooze is for. The queue offers a
   * way to see them again, because something set aside and then forgotten is
   * worse than something never set aside at all.
   */
  includeSnoozed?: boolean;
};

/** Whether this item is currently set aside, at the given moment. */
export function isSnoozed(item: QueueItem, now: Date): boolean {
  return item.snoozedUntil !== null &&
    item.snoozedUntil !== undefined &&
    item.snoozedUntil.getTime() > now.getTime();
}

export function sortQueue<T extends QueueItem>(
  items: T[],
  viewer: Viewer,
  options: SortOptions = {},
): { group: QueueGroup; items: T[] }[] {
  const now = options.now ?? new Date();
  const buckets = new Map<QueueGroup, T[]>();

  for (const group of GROUP_ORDER) buckets.set(group, []);

  for (const item of items) {
    if (!options.includeSnoozed && isSnoozed(item, now)) continue;
    buckets.get(groupFor(item, viewer))!.push(item);
  }

  return GROUP_ORDER.map((group) => ({
    group,
    items: buckets.get(group)!.sort((a, b) => {
      /*
        Three keys, in this order.

        Overdue first, whatever it is. Something that has sat for a day is
        somebody's bad day regardless of which kind of work it is, and burying
        it under a fresher item of a more urgent type is how it stays buried.
        Only the overdue jump: sorting everything by age would throw away the
        role ordering below, which is what tells someone where to start.
      */
      const aOld = jumpsQueue(agingLevel(a.waitingSince, now));
      const bOld = jumpsQueue(agingLevel(b.waitingSince, now));
      if (aOld !== bOld) return aOld ? -1 : 1;

      // Then what this role should do first.
      const byRole = priorityFor(a, viewer) - priorityFor(b, viewer);
      if (byRole !== 0) return byRole;

      // Then oldest waiting: the longer something has sat, the more urgent.
      return a.waitingSince.getTime() - b.waitingSince.getTime();
    }),
  })).filter((bucket) => bucket.items.length > 0);
}
