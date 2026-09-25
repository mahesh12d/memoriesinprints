import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { proofComments, users } from "@/db/schema";
import { signedReadUrl } from "@/lib/storage/storage";
import type { ProofComment, ProofSheet } from "@/components/proofs/proof-canvas";

/**
 * A proof's pages and its pins, ready to hand to the reviewer.
 *
 * Both were built inline on the customer's proof page, which is why the
 * studio's own screens showed a link to the raw file instead: putting the
 * same reviewer in front of a proofreader meant copying forty lines of
 * signing and joining. It is one import now, so whoever checks the work gets
 * the same tools as whoever receives it.
 */

type StoredVersion = {
  storageKey: string;
  sheets: { key: string; name: string }[];
};

/**
 * Every sheet, signed for reading.
 *
 * A proof saved before it had sheets has only its single storageKey, so that
 * becomes a one-sheet proof rather than an empty one.
 */
export async function signSheets(version: StoredVersion): Promise<ProofSheet[]> {
  const stored =
    version.sheets.length > 0
      ? version.sheets
      : [{ key: version.storageKey, name: "Proof" }];

  return Promise.all(
    stored.map(async (sheet) => ({
      key: sheet.key,
      name: sheet.name,
      url: await signedReadUrl(sheet.key),
    })),
  );
}

/**
 * The pins on one version, in the order they were placed.
 *
 * `onlyAuthorId` narrows them to one person's marks, which is how the
 * customer's screen stays the customer's: now that a proofreader can pin
 * mistakes to the artwork, those notes are internal working — written for the
 * designer, about work the family has not been shown yet — and must not turn
 * up on the proof when it is sent on. The studio's own screens pass nothing
 * and see every mark.
 */
export async function loadPins(
  proofVersionId: string,
  viewerId: string,
  onlyAuthorId?: string,
): Promise<ProofComment[]> {
  const rows = await db
    .select({
      id: proofComments.id,
      body: proofComments.body,
      sheetIndex: proofComments.sheetIndex,
      xPct: proofComments.xPct,
      yPct: proofComments.yPct,
      pinNumber: proofComments.pinNumber,
      authorId: proofComments.authorId,
      authorName: users.name,
    })
    .from(proofComments)
    .leftJoin(users, eq(users.id, proofComments.authorId))
    .where(
      and(
        eq(proofComments.proofVersionId, proofVersionId),
        onlyAuthorId ? eq(proofComments.authorId, onlyAuthorId) : undefined,
      ),
    )
    .orderBy(asc(proofComments.pinNumber));

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    sheetIndex: row.sheetIndex,
    xPct: row.xPct,
    yPct: row.yPct,
    pinNumber: row.pinNumber,
    authorName: row.authorName ?? "Someone",
    // Only your own marks can be taken back off the proof.
    isMine: row.authorId === viewerId,
  }));
}
