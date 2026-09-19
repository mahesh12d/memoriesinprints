import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";

export type TokenPurpose = "email_verification" | "password_reset";

const TTL_MINUTES: Record<TokenPurpose, number> = {
  email_verification: 60 * 24, // a day
  password_reset: 60, // an hour
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Returns the raw token to put in the email link. Only its hash is stored, so a
 * leaked database backup can't be used to take over accounts.
 */
export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
): Promise<string> {
  // One live token per purpose — issuing a new one invalidates the old.
  await db
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.userId, userId),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.consumedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");

  await db.insert(verificationTokens).values({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(Date.now() + TTL_MINUTES[purpose] * 60_000),
  });

  return token;
}

/**
 * Consumes a token and returns the user it belongs to, or null if it is
 * unknown, expired, already used, or for a different purpose.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<{ userId: string } | null> {
  const rows = await db
    .select({ id: verificationTokens.id, userId: verificationTokens.userId })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hashToken(token)),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.consumedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Mark consumed in a guarded update so a double-submit can't use it twice.
  const consumed = await db
    .update(verificationTokens)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.id, row.id),
        isNull(verificationTokens.consumedAt),
      ),
    )
    .returning({ id: verificationTokens.id });

  if (consumed.length === 0) return null;

  return { userId: row.userId };
}
