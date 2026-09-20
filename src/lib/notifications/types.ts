/**
 * Shared shape for a bell row.
 *
 * Kept out of queries.ts because that module is `server-only`, and the bell
 * itself is a client component that needs the type.
 */
export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  createdAt: Date;
  isUnread: boolean;
};
