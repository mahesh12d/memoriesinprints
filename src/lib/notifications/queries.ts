import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { bundle } from "./bundle";
import type { Digest, NotificationGroup, NotificationRow } from "./types";

export type { NotificationRow, NotificationGroup, Digest };

/**
 * How many rows the panel reads.
 *
 * More than it shows, because bundling collapses them: twenty rows on one busy
 * order would otherwise fold to a single line and leave the panel looking
 * empty. The count covers everything unread regardless.
 */
const RECENT_LIMIT = 40;

/** After folding, how many lines the panel will show. */
const PANEL_LINES = 12;

export async function loadNotifications(userId: string): Promise<{
  items: NotificationGroup[];
  unreadCount: number;
}> {
  const [rows, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
        orderId: notifications.orderId,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(RECENT_LIMIT),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(eq(notifications.userId, userId), isNull(notifications.readAt)),
      ),
  ]);

  const items: NotificationRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    linkUrl: row.linkUrl,
    orderId: row.orderId,
    createdAt: row.createdAt,
    isUnread: row.readAt === null,
  }));

  return {
    items: bundle(items).slice(0, PANEL_LINES),
    unreadCount: unread?.count ?? 0,
  };
}

/**
 * Has anything happened — answered as cheaply as the question deserves.
 *
 * This is what every open page asks on a timer, so it is two aggregates over
 * one indexed column and no list at all. The caller refreshes only when
 * latestEventAt moves, which is what keeps a quiet afternoon from re-rendering
 * the queue four times a minute.
 */
export async function digestFor(userId: string): Promise<Digest> {
  const [row] = await db
    .select({
      unreadCount: sql<number>`count(*) filter (where ${notifications.readAt} is null)::int`,
      latestEventAt: sql<Date | null>`max(${notifications.createdAt})`,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId));

  return {
    unreadCount: row?.unreadCount ?? 0,
    latestEventAt: row?.latestEventAt
      ? new Date(row.latestEventAt).getTime()
      : null,
  };
}
