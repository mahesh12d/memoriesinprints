import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, type User } from "@/db/schema";

export type SessionScope = "site" | "admin";

/**
 * Two cookies, never interchangeable: a customer or staff session can't reach
 * /admin, and an admin session can't act as a customer. This is what keeps the
 * admin login independent of customer auth.
 */
const COOKIE_NAME: Record<SessionScope, string> = {
  site: "mip_session",
  admin: "mip_admin_session",
};

const SESSION_TTL_DAYS = 30;
/** Only touch last_seen_at when it's this stale, to avoid a write per request. */
const TOUCH_AFTER_MS = 10 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = Pick<
  User,
  "id" | "email" | "name" | "role" | "emailVerifiedAt" | "isDisabled"
>;

export type ActiveSession = {
  id: string;
  user: SessionUser;
  scope: SessionScope;
};

export async function createSession(
  userId: string,
  scope: SessionScope = "site",
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    scope,
    userAgent: headerList.get("user-agent")?.slice(0, 500) ?? null,
    ipAddress: forwardedFor?.split(",")[0]?.trim() ?? null,
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME[scope], token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Reads the caller's session, or null. Safe to call on every request. */
export async function getSession(
  scope: SessionScope = "site",
): Promise<ActiveSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME[scope])?.value;
  if (!token) return null;

  const rows = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      scope: sessions.scope,
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      isDisabled: users.isDisabled,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        eq(sessions.scope, scope),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // A disabled account loses access immediately, without waiting for logout.
  if (row.isDisabled) return null;

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    id: row.sessionId,
    scope: row.scope,
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      emailVerifiedAt: row.emailVerifiedAt,
      isDisabled: row.isDisabled,
    },
  };
}

export async function destroySession(
  scope: SessionScope = "site",
): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME[scope])?.value;

  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }

  cookieStore.delete(COOKIE_NAME[scope]);
}

/** Everything the security page shows, current session marked. */
export async function listActiveSessions(userId: string, currentId: string) {
  const rows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ipAddress: sessions.ipAddress,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      scope: sessions.scope,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    );

  return rows
    .map((row) => ({ ...row, isCurrent: row.id === currentId }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.lastSeenAt.getTime() - a.lastSeenAt.getTime();
    });
}

export async function revokeSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
}

/** "Sign out everywhere else" — keeps the caller logged in. */
export async function revokeOtherSessions(
  userId: string,
  keepSessionId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.userId, userId),
        ne(sessions.id, keepSessionId),
        isNull(sessions.revokedAt),
      ),
    );
}

/** Used after a password change: every other session dies. */
export async function revokeAllSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
