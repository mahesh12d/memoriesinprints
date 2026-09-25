import { NotificationBell } from "./notification-bell";
import { loadNotifications } from "@/lib/notifications/queries";
import {
  getNotificationDigestAction,
  markNotificationReadAction,
  markNotificationsReadAction,
} from "@/lib/notifications/actions";

/**
 * The bell, fetched and wired.
 *
 * Three layouts mount this — staff, admin and customer — and none of them should
 * have to know which queries and which actions the bell needs. Adding a fourth
 * is one line in that layout.
 */
export async function Bell({ userId }: { userId: string }) {
  const { items, unreadCount } = await loadNotifications(userId);

  return (
    <NotificationBell
      items={items}
      unreadCount={unreadCount}
      markRead={markNotificationsReadAction}
      markOneRead={markNotificationReadAction}
      readDigest={getNotificationDigestAction}
    />
  );
}
