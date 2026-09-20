import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import type { NotificationRow } from "./types";

export type { NotificationRow };

/** The bell shows the ten most recent; the count covers everything unread. */
const RECENT_LIMIT = 10;

export async function loadNotifications(userId: string): Promise<{
  items: NotificationRow[];
  unreadCount: number;
}> {
  const [rows, [unread]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        title: notifications.title,
        body: notifications.body,
        linkUrl: notifications.linkUrl,
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

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      linkUrl: row.linkUrl,
      createdAt: row.createdAt,
      isUnread: row.readAt === null,
    })),
    unreadCount: unread?.count ?? 0,
  };
}
