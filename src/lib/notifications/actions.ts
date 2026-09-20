"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";

/**
 * Clears the unread badge.
 *
 * Called when the panel is opened, so the bell reflects what the customer has
 * actually seen. The user id comes from the session — never from the client.
 */
export async function markNotificationsReadAction(): Promise<void> {
  const session = await requireUser();

  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        isNull(notifications.readAt),
      ),
    );

  revalidatePath("/account", "layout");
}
