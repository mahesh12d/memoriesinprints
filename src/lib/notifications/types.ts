/**
 * Shared shapes for the bell and the queue.
 *
 * Kept out of queries.ts because that module is `server-only`, and the bell,
 * the queue rows and the poller are all client components that need these.
 */

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  /** Which order it is about, which is what the panel groups on. */
  orderId: string | null;
  createdAt: Date;
  isUnread: boolean;
};

/**
 * Several events on one order, folded into a single line.
 *
 * A designer uploading a proof page by page used to fill the panel with its
 * own work; ten rows saying nearly the same thing hide the one row that does
 * not. Folding happens when the panel is read rather than when the events are
 * written, so the timeline keeps every step.
 */
export type NotificationGroup = {
  /** The newest row in the bundle — the key, and where the link comes from. */
  id: string;
  /** Every row folded in, so clearing the line clears all of them. */
  ids: string[];
  orderId: string | null;
  title: string;
  body: string | null;
  linkUrl: string | null;
  createdAt: Date;
  isUnread: boolean;
  /** How many events this line stands for. 1 means nothing was folded. */
  count: number;
};

/**
 * The cheap poll response: enough to know whether anything changed, and
 * nothing more.
 *
 * latestEventAt is a millisecond epoch rather than a Date because it crosses
 * the wire on a timer and is only ever compared against the last one seen.
 */
export type Digest = {
  unreadCount: number;
  latestEventAt: number | null;
};
