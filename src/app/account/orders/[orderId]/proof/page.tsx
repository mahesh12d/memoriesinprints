import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders, proofComments, proofVersions, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { signedReadUrl } from "@/lib/storage/storage";
import { isPdf } from "@/lib/storage/uploads";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ProofReviewer } from "@/components/proofs/proof-reviewer";

export const metadata: Metadata = {
  title: "Review your proof",
  robots: { index: false, follow: false },
};

export default async function ProofReviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireUser();
  const { orderId } = await params;

  const [order] = await db
    .select({ id: orders.id, reference: orders.reference })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, session.user.id)))
    .limit(1);

  if (!order) notFound();

  const [version] = await db
    .select({
      id: proofVersions.id,
      versionNumber: proofVersions.versionNumber,
      storageKey: proofVersions.storageKey,
      mimeType: proofVersions.mimeType,
      status: proofVersions.status,
    })
    .from(proofVersions)
    .where(eq(proofVersions.orderId, orderId))
    .orderBy(desc(proofVersions.versionNumber))
    .limit(1);

  if (!version) {
    return (
      <>
        <PortalHeader title={`Proof — ${order.reference}`} />
        <PortalBody>
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <h2 className="font-display text-lg">No proof yet</h2>
            <p className="mx-auto mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-muted">
              The studio is working on it. We&rsquo;ll email you the moment
              there&rsquo;s something to look at.
            </p>
            <Link
              href="/account/orders"
              className="mt-6 inline-flex rounded-[2px] border border-field-line px-6 py-3 text-[13px] font-semibold text-ink-soft"
            >
              Back to orders
            </Link>
          </div>
        </PortalBody>
      </>
    );
  }

  const rows = await db
    .select({
      id: proofComments.id,
      body: proofComments.body,
      xPct: proofComments.xPct,
      yPct: proofComments.yPct,
      pinNumber: proofComments.pinNumber,
      authorId: proofComments.authorId,
      authorName: users.name,
    })
    .from(proofComments)
    .leftJoin(users, eq(users.id, proofComments.authorId))
    .where(eq(proofComments.proofVersionId, version.id))
    .orderBy(asc(proofComments.pinNumber));

  const fileUrl = await signedReadUrl(version.storageKey);

  // Opening the proof clears the notification that brought them here.
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.linkUrl, `/account/orders/${orderId}/proof`),
      ),
    );

  return (
    <>
      <PortalHeader
        title={`Proof — ${order.reference}`}
        actions={
          <Link
            href="/account/orders"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Orders
          </Link>
        }
      />
      <PortalBody>
        <ProofReviewer
          proofVersionId={version.id}
          fileUrl={fileUrl}
          downloadUrl={fileUrl}
          isPdf={isPdf(version.mimeType)}
          status={version.status}
          versionNumber={version.versionNumber}
          comments={rows.map((row) => ({
            id: row.id,
            body: row.body,
            xPct: row.xPct,
            yPct: row.yPct,
            pinNumber: row.pinNumber,
            authorName: row.authorName ?? "Someone",
            isMine: row.authorId === session.user.id,
          }))}
        />
      </PortalBody>
    </>
  );
}
