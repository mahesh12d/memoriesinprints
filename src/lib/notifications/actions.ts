"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders } from "@/db/schema";
import { mayOpenProof, requireViewer } from "@/lib/auth/guards";
import { isUuid } from "@/lib/utils";
import {
  setOrderSnooze,
  touchOrderWatcher,
} from "./watchers";
import { digestFor } from "./queries";
import type { Digest } from "./types";

/**
 * Clears the unread badge.
 *
 * Called when the panel is opened, so the bell reflects what the customer has
 * actually seen. The user id comes from the session — never from the client.
 */
export async function markNotificationsReadAction(): Promise<void> {
  const session = await requireViewer();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );

  /*
    The bell lives in all three sidebars, and each sidebar is a different
    layout, so all three are refreshed. Revalidating only the one the click came
    from would leave the badge stale in the other tab someone has open.
  */
  revalidatePath("/account", "layout");
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
}

/**
 * Marks one bell row read, for the case where someone clears a single line
 * rather than the whole panel.
 *
 * Ownership is in the WHERE clause rather than checked first, so a forged id
 * matches nothing instead of reading someone else's row.
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<void> {
  const session = await requireViewer();
  if (!isUuid(notificationId)) return;

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );

  /*
    The bell lives in all three sidebars, and each sidebar is a different
    layout, so all three are refreshed. Revalidating only the one the click came
    from would leave the badge stale in the other tab someone has open.
  */
  revalidatePath("/account", "layout");
  revalidatePath("/staff", "layout");
  revalidatePath("/admin", "layout");
}

/**
 * Records that the caller has looked at an order.
 *
 * Called from the browser once the order page is actually on screen, not
 * during its render: a render happens when a link is prefetched too, and
 * marking work seen because someone's pointer crossed it would clear the very
 * signal these markers carry.
 *
 * Authorised against the order the same way opening it is, so this cannot be
 * used to probe which order ids exist.
 */
export async function markOrderViewedAction(orderId: string): Promise<void> {
  const session = await requireViewer();
  if (!isUuid(orderId)) return;

  const [order] = await db
    .select({
      ownerId: orders.userId,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;
  if (!mayOpenProof(session.user, order)) return;

  await touchOrderWatcher(orderId, session.user.id);
}

/** How long a snooze lasts, as the picker offers it. */
const SNOOZE_MINUTES = {
  "1h": 60,
  "4h": 4 * 60,
  tomorrow: 0,
} as const;

export type SnoozeFor = keyof typeof SNOOZE_MINUTES;

/**
 * Sets an order aside for the caller.
 *
 * Seen but not ready to act on, which is neither unread nor handled — the
 * middle state a plain read/unread flag has nowhere to put. New activity on the
 * order cancels it; see recordOrderEvent.
 */
export async function snoozeOrderAction(
  orderId: string,
  until: SnoozeFor,
): Promise<void> {
  const session = await requireViewer();
  if (!isUuid(orderId)) return;

  const [order] = await db
    .select({
      ownerId: orders.userId,
      assignedDesignerId: orders.assignedDesignerId,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) return;
  if (!mayOpenProof(session.user, order)) return;

  let at: Date;

  if (until === "tomorrow") {
    // Nine in the morning, which is when the studio next looks at anything.
    at = new Date();
    at.setDate(at.getDate() + 1);
    at.setHours(9, 0, 0, 0);
  } else {
    at = new Date(Date.now() + SNOOZE_MINUTES[until] * 60_000);
  }

  await setOrderSnooze(orderId, session.user.id, at);

  revalidatePath("/staff/queue");
  revalidatePath("/staff");
}

/** Puts a snoozed order back in the caller's queue straight away. */
export async function unsnoozeOrderAction(orderId: string): Promise<void> {
  const session = await requireViewer();
  if (!isUuid(orderId)) return;

  await setOrderSnooze(orderId, session.user.id, null);

  revalidatePath("/staff/queue");
  revalidatePath("/staff");
}

/**
 * The cheap "has anything changed" check the pages poll.
 *
 * Two aggregates over one indexed column each, and no list — a page asking
 * every fifteen seconds must not cost what drawing the panel costs. The client
 * compares latestEventAt against what it last saw and only refreshes when it
 * has moved.
 */
export async function getNotificationDigestAction(): Promise<Digest> {
  const session = await requireViewer();
  return digestFor(session.user.id);
}
