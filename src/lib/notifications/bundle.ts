import type { NotificationGroup, NotificationRow } from "./types";

/**
 * How the bell folds a burst of events into one line, kept free of database
 * imports so the rule can be tested on its own.
 *
 * The problem it solves: a designer working through a booklet produces an event
 * per page, and ten rows saying nearly the same thing bury the one row that
 * says something else. Anything about the same order inside the window below
 * reads as one line carrying a count.
 */

/**
 * How close together events have to be to count as one piece of news.
 *
 * Half an hour, which is about how long someone spends on one order in a
 * sitting. Long enough that working through a proof reads as one action;
 * short enough that a customer coming back the next morning does not fold into
 * what the studio did the night before.
 */
const WINDOW_MS = 30 * 60_000;

/**
 * Folds a newest-first list of rows into display lines.
 *
 * Only *adjacent* rows fold, so a bundle never reaches back across unrelated
 * news to collect a straggler: three events on MP-1060, then one on MP-1061,
 * then another on MP-1060 stays three lines. What is between two events is
 * part of what happened.
 *
 * Rows with no order never fold — there is nothing to fold them on, and each
 * one is its own piece of news.
 */
export function bundle(rows: NotificationRow[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];

  for (const row of rows) {
    const open = groups[groups.length - 1];

    const foldable =
      open !== undefined &&
      row.orderId !== null &&
      open.orderId === row.orderId &&
      // Newest-first, so the open group is always the later of the two.
      open.createdAt.getTime() - row.createdAt.getTime() <= WINDOW_MS;

    if (foldable) {
      open.ids.push(row.id);
      open.count += 1;
      // Unread if any row in it is: a line the panel offers to clear has to
      // account for everything it would clear.
      open.isUnread = open.isUnread || row.isUnread;
      continue;
    }

    groups.push({
      id: row.id,
      ids: [row.id],
      orderId: row.orderId,
      // The newest row's wording leads, because it is what just happened.
      title: row.title,
      body: row.body,
      linkUrl: row.linkUrl,
      createdAt: row.createdAt,
      isUnread: row.isUnread,
      count: 1,
    });
  }

  return groups;
}

/** An activity row, as the dashboard feed has it. */
export type ActivityLike = {
  id: string;
  orderId: string | null;
  summary: string;
  createdAt: Date;
};

export type FoldedActivity = ActivityLike & {
  /** How many further rows folded into this one. 0 means none did. */
  folded: number;
  /** Whether this viewer has seen the order it is about. */
  unseen: boolean;
};

/**
 * The same fold, applied to the studio's activity feed.
 *
 * The bell panel and the dashboard feed show the same events and must agree
 * about what counts as one piece of news — two windows would mean a burst
 * reading as one line in the sidebar and six in the page beside it.
 *
 * Unseen is per order rather than per row: the caller has already worked out
 * which orders have activity this person has not looked at, and a row about an
 * order they have seen is not new even if the row itself is.
 */
export function foldActivity(
  rows: ActivityLike[],
  unseenOrderIds: Set<string>,
): FoldedActivity[] {
  const out: FoldedActivity[] = [];

  for (const row of rows) {
    const open = out[out.length - 1];

    const foldable =
      open !== undefined &&
      row.orderId !== null &&
      open.orderId === row.orderId &&
      open.createdAt.getTime() - row.createdAt.getTime() <= WINDOW_MS;

    if (foldable) {
      open.folded += 1;
      continue;
    }

    out.push({
      ...row,
      folded: 0,
      unseen: row.orderId !== null && unseenOrderIds.has(row.orderId),
    });
  }

  return out;
}

/** How a folded line reads under its title: "and 3 more updates". */
export function bundleNote(group: NotificationGroup): string | null {
  if (group.count <= 1) return null;
  const others = group.count - 1;
  return `and ${others} more update${others === 1 ? "" : "s"}`;
}
