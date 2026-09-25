import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications, orders, proofVersions } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { loadPins, signSheets } from "@/lib/proofs/sheets";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ProofReviewer } from "@/components/proofs/proof-reviewer";
import { MarkViewed } from "@/components/portal/mark-viewed";
import { isUuid } from "@/lib/utils";

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
  if (!isUuid(orderId)) notFound();

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
      sheets: proofVersions.sheets,
      storageKey: proofVersions.storageKey,
      mimeType: proofVersions.mimeType,
      status: proofVersions.status,
    })
    .from(proofVersions)
    .where(
      and(
        eq(proofVersions.orderId, orderId),
        /*
          Only what has been sent to them.

          The newest version was shown whatever its state, so a proof still
          with the proofreader — or one they had returned to the designer to
          fix — was readable by the customer at this URL before anyone in the
          studio had checked it. An unsent version falls through to the "no
          proof yet" message below, which is the truth from where they sit.
        */
        isNotNull(proofVersions.sentToCustomerAt),
      ),
    )
    .orderBy(desc(proofVersions.versionNumber))
    .limit(1);

  if (!version) {
    return (
      <>
        <PortalHeader title={`Proof — ${order.reference}`} />
        <PortalBody>
          <div className="rounded-md border border-line bg-card p-10 text-center">
            <h2 className="font-display text-lg">No Proof Yet</h2>
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

  // Both of these are shared with the studio's own screens, so a proofreader
  // reads exactly what the customer reads.
  const [sheets, pins] = await Promise.all([
    signSheets(version),
    // Their own marks only — the studio's are internal working.
    loadPins(version.id, session.user.id, session.user.id),
  ]);

  const fileUrl = sheets[0]?.url ?? "";

  /*
    Opening the proof clears the notifications that brought them here.

    Matched on the order rather than on the link text now that a notification
    carries the order it is about: a comment left on the proof links to this same
    page, and a rule written against a URL string quietly stops matching the day
    one of those links gains a query parameter.
  */
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.userId, session.user.id),
        eq(notifications.orderId, orderId),
        isNull(notifications.readAt),
      ),
    );

  return (
    <>
      {/*
        Records that they have looked at this order, so the "new" marks on their
        own orders list and dashboard clear — and so the studio's "with the
        customer" rows can tell a proof that has been opened from one that has
        been sitting unread since it was sent.
      */}
      <MarkViewed orderId={orderId} />

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
          sheets={sheets}
          downloadUrl={fileUrl}
          status={version.status}
          versionNumber={version.versionNumber}
          comments={pins}
        />
      </PortalBody>
    </>
  );
}
