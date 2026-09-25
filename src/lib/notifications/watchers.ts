import "server-only";

import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { orders, orderWatchers } from "@/db/schema";

/**
 * "What is new since I last looked", per person, per order.
 *
 * The comparison is always the same one: the order's lastActivityAt against
 * this viewer's lastViewedAt. No watcher row means they have never opened it,
 * so everything on it is new — which is why an absent row reads as unseen
 * rather than as seen.
 */

/**
 * When this person last opened this order, without recording that they have
 * opened it again.
 *
 * Read and write are deliberately two calls. A page render is not evidence
 * that anyone looked: hovering a link in the queue prefetches the order, and a
 * render that marked it seen would clear the "new" dot on work nobody had
 * opened — the exact thing these markers exist to show. So the page reads this
 * during render and the browser records the visit afterwards.
 *
 * It is also the timestamp the order's history draws its "since your last
 * visit" line at, which only works if it is read before being overwritten.
 */
export async function getLastViewedAt(
  orderId: string,
  userId: string,
): Promise<Date | null> {
  const [existing] = await db
    .select({ lastViewedAt: orderWatchers.lastViewedAt })
    .from(orderWatchers)
    .where(
      and(eq(orderWatchers.orderId, orderId), eq(orderWatchers.userId, userId)),
    )
    .limit(1);

  return existing?.lastViewedAt ?? null;
}

/** Records that this person has now looked at this order. */
export async function touchOrderWatcher(
  orderId: string,
  userId: string,
): Promise<void> {
  const now = new Date();

  await db
    .insert(orderWatchers)
    .values({ orderId, userId, lastViewedAt: now })
    /*
      One row per person per order, so a second visit updates rather than
      accumulating. The unique index is what makes this safe when two tabs open
      the same order at once.
    */
    .onConflictDoUpdate({
      target: [orderWatchers.orderId, orderWatchers.userId],
      set: { lastViewedAt: now },
    });
}

/**
 * Which of these orders have activity this person has not seen.
 *
 * Takes the list rather than querying every order, because the caller has
 * already scoped it to what this viewer is allowed to see — a designer's own
 * jobs, a customer's own orders — and that scoping must not be undone here.
 */
export async function getUnseenOrderIds(
  userId: string,
  orderIds: string[],
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();

  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .leftJoin(
      orderWatchers,
      and(
        eq(orderWatchers.orderId, orders.id),
        eq(orderWatchers.userId, userId),
      ),
    )
    .where(
      and(
        inArray(orders.id, orderIds),
        or(
          // Never opened, so all of it is new.
          isNull(orderWatchers.lastViewedAt),
          gt(orders.lastActivityAt, orderWatchers.lastViewedAt),
        ),
      ),
    );

  return new Set(rows.map((row) => row.id));
}

/**
 * Which of these orders this person has set aside, and until when.
 *
 * Snoozes that have run out are not returned: the row is left in place
 * (clearing it would cost a write on every read) and simply stops counting.
 */
export async function getSnoozedOrderIds(
  userId: string,
  orderIds: string[],
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();

  const rows = await db
    .select({ orderId: orderWatchers.orderId })
    .from(orderWatchers)
    .where(
      and(
        eq(orderWatchers.userId, userId),
        inArray(orderWatchers.orderId, orderIds),
        gt(orderWatchers.snoozedUntil, new Date()),
      ),
    );

  return new Set(rows.map((row) => row.orderId));
}

/** Sets an order aside for this person until the given time. */
export async function setOrderSnooze(
  orderId: string,
  userId: string,
  until: Date | null,
): Promise<void> {
  await db
    .insert(orderWatchers)
    .values({ orderId, userId, snoozedUntil: until })
    .onConflictDoUpdate({
      target: [orderWatchers.orderId, orderWatchers.userId],
      set: { snoozedUntil: until },
    });
}
