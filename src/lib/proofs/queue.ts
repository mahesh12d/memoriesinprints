/**
 * How the studio work queue is ordered, kept free of database imports so the
 * rule can be tested on its own.
 *
 * The spec asks for whatever this viewer should act on next to come first,
 * and oldest-waiting first within that. So the ordering is by group, and by
 * age inside each group — the piece that has been sitting longest is the one
 * most likely to be someone's bad day.
 */

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
      status === null) &&
    isTheirs
  ) {
    return "awaiting_you";
  }

  if (status === "awaiting_proofreading") return "awaiting_customer";

  return "needs_work";
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

export function sortQueue<T extends QueueItem>(
  items: T[],
  viewer: Viewer,
): { group: QueueGroup; items: T[] }[] {
  const buckets = new Map<QueueGroup, T[]>();

  for (const group of GROUP_ORDER) buckets.set(group, []);

  for (const item of items) {
    buckets.get(groupFor(item, viewer))!.push(item);
  }

  return GROUP_ORDER.map((group) => ({
    group,
    items: buckets
      .get(group)!
      // Oldest waiting first: the longer something has sat, the more urgent.
      .sort((a, b) => a.waitingSince.getTime() - b.waitingSince.getTime()),
  })).filter((bucket) => bucket.items.length > 0);
}
