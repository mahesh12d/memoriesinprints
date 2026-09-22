import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, proofVersions } from "@/db/schema";
import { buildArchiveKey, copyObject } from "@/lib/storage/storage";

/**
 * Files a completed order's final artwork into the archive.
 *
 * The working file stays where it is — this takes a copy into archive/, so
 * the record survives the two-version rule that will eventually drop the
 * working copy. Archiving is idempotent: an order marked delivered twice ends
 * up with one archived file, not two.
 *
 * A failure here never fails the status change. The order genuinely has been
 * delivered; refusing to record that because a bucket was briefly unreachable
 * would be the worse outcome. It's logged and left for a retry instead.
 */
export async function archiveFinalProof(
  orderId: string,
  reference: string,
  actorId: string,
): Promise<{ archived: boolean; reason?: string }> {
  const [latest] = await db
    .select({
      id: proofVersions.id,
      versionNumber: proofVersions.versionNumber,
      storageKey: proofVersions.storageKey,
      fileName: proofVersions.fileName,
    })
    .from(proofVersions)
    .where(
      and(eq(proofVersions.orderId, orderId), isNull(proofVersions.archivedAt)),
    )
    .orderBy(desc(proofVersions.versionNumber))
    .limit(1);

  if (!latest) return { archived: false, reason: "nothing to archive" };

  const archivedStorageKey = buildArchiveKey(
    reference,
    latest.versionNumber,
    latest.fileName,
  );

  try {
    await copyObject(latest.storageKey, archivedStorageKey);
  } catch (error) {
    console.error("[proofs] could not archive final artwork", error);
    return { archived: false, reason: "storage" };
  }

  await db
    .update(proofVersions)
    .set({ archivedStorageKey, archivedAt: new Date() })
    .where(eq(proofVersions.id, latest.id));

  await db.insert(activityEvents).values({
    orderId,
    actorId,
    type: "proof_archived",
    summary: `Version ${latest.versionNumber} of ${reference} was archived`,
  });

  return { archived: true };
}
