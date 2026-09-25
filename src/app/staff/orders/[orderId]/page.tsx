import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  orders,
  proofComments,
  proofVersions,
  users,
} from "@/db/schema";
import {
  canSeeAllOrders,
  canSeeMoney,
  canUploadProofs,
  requireStaff,
} from "@/lib/auth/guards";
import { loadDesigners } from "@/lib/proofs/staff-queries";
import { formatMoney } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ActivityTimeline } from "@/components/portal/activity-timeline";
import { StatusPill, type PillTone } from "@/components/portal/status-pill";
import { StaffProgress } from "@/components/portal/staff-progress";
import { ProofCompare } from "@/components/proofs/proof-compare";
import { ProofReviewer } from "@/components/proofs/proof-reviewer";
import { loadPins, signSheets } from "@/lib/proofs/sheets";
import { isUuid } from "@/lib/utils";
import {
  AssignDesignerForm,
  ProofreaderActions,
  SubmitProofForm,
  UploadProofForm,
} from "./proof-actions";

const PROOF_LABEL: Record<string, { label: string; tone: PillTone }> = {
  awaiting_proofreading: { label: "Needs proofreading", tone: "pending" },
  returned_to_designer: { label: "Returned to designer", tone: "alert" },
  awaiting_customer: { label: "With the customer", tone: "neutral" },
  approved: { label: "Approved", tone: "good" },
  changes_requested: { label: "Changes requested", tone: "alert" },
};

const PAYMENT: Record<string, { label: string; tone: PillTone }> = {
  unpaid: { label: "Unpaid", tone: "neutral" },
  paid: { label: "Paid", tone: "good" },
  refunded: { label: "Refunded", tone: "alert" },
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function StaffOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await requireStaff();
  const { orderId } = await params;
  if (!isUuid(orderId)) notFound();

  const [order] = await db
    .select({
      id: orders.id,
      reference: orders.reference,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      totalMinor: orders.totalMinor,
      currency: orders.currency,
      assignedDesignerId: orders.assignedDesignerId,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) notFound();

  // Not a redirect: a designer shouldn't be able to learn that an order exists
  // by watching where they get sent.
  if (
    !canSeeAllOrders(session.user.role) &&
    order.assignedDesignerId !== session.user.id
  ) {
    notFound();
  }

  const showMoney = canSeeMoney(session.user.role);
  const canUpload = canUploadProofs(session.user.role);

  const [versions, designers, activity] = await Promise.all([
    db
      .select({
        id: proofVersions.id,
        versionNumber: proofVersions.versionNumber,
        status: proofVersions.status,
        storageKey: proofVersions.storageKey,
        sheets: proofVersions.sheets,
        fileName: proofVersions.fileName,
        mimeType: proofVersions.mimeType,
        createdAt: proofVersions.createdAt,
        proofreaderNotes: proofVersions.proofreaderNotes,
        uploadedBy: users.name,
      })
      .from(proofVersions)
      .leftJoin(users, eq(users.id, proofVersions.uploadedById))
      .where(eq(proofVersions.orderId, orderId))
      .orderBy(desc(proofVersions.versionNumber)),
    loadDesigners(),
    db
      .select({
        id: activityEvents.id,
        summary: activityEvents.summary,
        createdAt: activityEvents.createdAt,
      })
      .from(activityEvents)
      .where(eq(activityEvents.orderId, orderId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(8),
  ]);

  const current = versions[0] ?? null;

  /**
   * The comments shown are the newest ones the customer left, which is
   * usually on an *earlier* version — a new version is uploaded precisely
   * because of them, and the designer still needs to see what they said.
   */
  const commentedOn =
    versions.find((version) => version.status === "changes_requested") ??
    current;

  const comments = commentedOn
    ? await db
      .select({
        id: proofComments.id,
        body: proofComments.body,
        pinNumber: proofComments.pinNumber,
        authorName: users.name,
      })
      .from(proofComments)
      .leftJoin(users, eq(users.id, proofComments.authorId))
      .where(eq(proofComments.proofVersionId, commentedOn.id))
      .orderBy(asc(proofComments.pinNumber))
    : [];

  const previous = versions[1] ?? null;

  /**
   * The current proof as pages, with whatever is already pinned to it.
   *
   * The studio used to get a link to the raw file — a Cloudflare URL opening
   * in a new tab — which meant the person whose job is to catch mistakes
   * could only look, never mark. They read the same artwork with the same
   * tools the customer gets, so a wrong middle name is pinned to the place it
   * appears rather than described in a note.
   */
  const [currentSheets, previousSheets, pins] = await Promise.all([
    current ? signSheets(current) : Promise.resolve([]),
    previous ? signSheets(previous) : Promise.resolve([]),
    current ? loadPins(current.id, session.user.id) : Promise.resolve([]),
  ]);

  const currentFileUrl = currentSheets[0]?.url ?? null;


  const canProofread =
    session.user.role === "proofreader" || session.user.role === "admin";

  return (
    <>
      <PortalHeader
        title={order.reference}
        actions={
          <Link
            href="/staff/queue"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Queue
          </Link>
        }
      />

      <PortalBody>
        {/*
          Where this job stands, above everything else on the page: a designer
          opening it wants to know whether it is back with them, and a
          proofreader whether it is waiting on them.
        */}
        <section className="mb-8 rounded-md border border-line bg-card p-6">
          <StaffProgress
            status={order.status}
            proofStatus={current?.status ?? null}
            hasDesigner={Boolean(order.assignedDesignerId)}
            hasProof={versions.length > 0}
          />
        </section>

        <div className="flex flex-col gap-8">
          {/*
            Everything that is reference rather than work, in one band across
            the top.

            These three sat in a right-hand column, which cost the workspace a
            third of the page for panels nobody edits twice — and pushed the
            proof itself into a narrow strip that had to be scrolled to reach.
            The artwork gets the full width below; this row is what you glance
            at on the way past.
          */}
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-md border border-line bg-card p-6">
              <h2 className="font-display text-lg">Order</h2>
              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Customer</dt>
                  <dd className="text-right font-semibold">
                    {order.customerName}
                  </dd>
                </div>
                {showMoney && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Total</dt>
                    <dd className="font-semibold">
                      {order.totalMinor !== null
                        ? formatMoney(order.totalMinor, order.currency)
                        : "—"}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Payment</dt>
                  <dd>
                    <StatusPill
                      tone={PAYMENT[order.paymentStatus]?.tone ?? "neutral"}
                    >
                      {PAYMENT[order.paymentStatus]?.label ??
                        order.paymentStatus}
                    </StatusPill>
                  </dd>
                </div>
              </dl>

              {/*
                A second tab, deliberately. The details and the artwork are
                read against each other — a name here, a date there — and one
                page cannot show both at once.
              */}
              <a
                href={`/staff/orders/${order.id}/order-form`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex w-fit items-center gap-2 rounded-[2px] bg-brand px-5 py-2.5 text-[13px] font-semibold text-on-accent hover:bg-brand-deep hover:text-white"
              >
                Open the order form
                <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6.5 3H3v10h10V9.5" />
                  <path d="M9.5 2.5H13.5V6.5" />
                  <path d="M13 3 8 8" />
                </svg>
              </a>

              {currentFileUrl && (
                <a
                  href={currentFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-[13px] font-semibold text-accent-text"
                >
                  Open the current proof file
                </a>
              )}
            </section>

            {/*
              Three across, not two nested inside one.

              Upload and history were in their own grid inside this row's
              middle column, so they shared a third of the page between them
              while the right-hand third stayed empty. They are siblings now:
              each card gets a third and the row fills the width.
            */}
            {canUpload && (
              <section className="rounded-md border border-line bg-card p-6">
                <h2 className="font-display text-lg">Upload a Proof</h2>
                <p className="mb-5 mt-1 text-[13px] text-ink-muted">
                  The order keeps the current proof and the one before it.
                  Uploading replaces the older of the two.
                </p>
                <UploadProofForm orderId={order.id} />
              </section>
            )}

            <ActivityTimeline entries={activity} scrollable collapsible={false} />
          </div>

          <div className="flex flex-col gap-6">


            {current && currentSheets.length > 0 && (
              <section className="rounded-md border border-line bg-card p-6">
                <h2 className="font-display text-lg">
                  Version {current.versionNumber}
                </h2>
                <div className="mt-4">
                  <ProofReviewer
                    proofVersionId={current.id}
                    sheets={currentSheets}
                    comments={pins}
                    status={current.status}
                    versionNumber={current.versionNumber}
                    downloadUrl={currentSheets[0].url}
                    audience="studio"
                    /*
                      The proofreader's two buttons, in the slot where the
                      customer gets approve and request-changes. A designer
                      looking at their own work gets neither: they can read it
                      and mark it, which is all their part of this is.
                    */
                    decision={
                      /*
                        Three different jobs against the same artwork: the
                        person who uploaded it hands it on, the proofreader
                        decides where it goes next, and everyone else just
                        reads it.
                      */
                      current.status === "draft" ? (
                        canUpload ? (
                          <div className="flex flex-col gap-3 rounded-md border border-brand-line bg-brand-tint p-6">
                            <h3 className="font-display text-[15px]">
                              Not Sent Yet
                            </h3>
                            <p className="text-[13px] leading-relaxed text-ink-soft">
                              Nobody else can see this version. Compare it
                              against the previous one below, check every
                              page, then send it to be proofread.
                            </p>
                            <SubmitProofForm
                              orderId={order.id}
                              versionNumber={current.versionNumber}
                            />
                          </div>
                        ) : (
                          <div className="rounded-md border border-line bg-card p-6">
                            <p className="text-[13px] leading-relaxed text-ink-muted">
                              The designer is still checking this version. It
                              will come to you when they send it.
                            </p>
                          </div>
                        )
                      ) : canProofread &&
                        current.status === "awaiting_proofreading" ? (
                        <div className="flex flex-col gap-3 rounded-md border border-line bg-card p-6">
                          <h3 className="font-display text-[15px]">
                            Checked It?
                          </h3>
                          <p className="text-[13px] leading-relaxed text-ink-muted">
                            Send it on to the customer, or return it to the
                            designer with what needs changing.
                          </p>
                          <ProofreaderActions orderId={order.id} />
                        </div>
                      ) : undefined
                    }
                  />
                </div>
              </section>
            )}

            {/*
              The comparison, and why it is not here.

              With one version there is nothing to wipe between, and the whole
              section used to vanish — which reads as a missing feature rather
              than as an empty one. It says which it is.
            */}
            {current && currentSheets.length > 0 && (
              <section className="rounded-md border border-line bg-card p-6">
                <h2 className="font-display text-lg">
                  {previous
                    ? `What changed since version ${previous.versionNumber}`
                    : "Compare with the previous version"}
                </h2>

                {previous && previousSheets.length > 0 ? (
                  <div className="mt-4">
                    <ProofCompare
                      previous={{
                        versionNumber: previous.versionNumber,
                        sheets: previousSheets,
                      }}
                      current={{
                        versionNumber: current.versionNumber,
                        sheets: currentSheets,
                      }}
                    />
                  </div>
                ) : (
                  <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
                    Version {current.versionNumber} is the only one there is,
                    so there is nothing to compare it against yet. Upload the
                    next version and the two appear here, one on top of the
                    other, with a divider to drag across them page by page.
                  </p>
                )}
              </section>
            )}

            {comments.length > 0 && (
              <section className="overflow-hidden rounded-md border border-line bg-card">
                <div className="border-b border-line-soft px-6 py-4">
                  <h2 className="font-display text-lg">
                    What the customer marked on version{" "}
                    {commentedOn?.versionNumber} ({comments.length})
                  </h2>
                </div>
                <ul>
                  {comments.map((comment) => (
                    <li
                      key={comment.id}
                      className="flex gap-3 border-b border-line-soft px-6 py-4 last:border-b-0"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-on-accent">
                        {comment.pinNumber}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <p className="text-[14px] leading-relaxed">
                          {comment.body}
                        </p>
                        <span className="text-[12px] text-ink-quiet">
                          {comment.authorName ?? "Customer"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="overflow-hidden rounded-md border border-line bg-card">
              <div className="border-b border-line-soft px-6 py-4">
                <h2 className="font-display text-lg">
                  Version history ({versions.length})
                </h2>
              </div>

              {versions.length === 0 ? (
                <p className="px-6 py-5 text-sm text-ink-muted">
                  Nothing uploaded yet.
                </p>
              ) : (
                <ul>
                  {versions.map((version) => (
                    <li
                      key={version.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4 last:border-b-0"
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">
                          Version {version.versionNumber}
                          {version.fileName ? ` · ${version.fileName}` : ""}
                        </span>
                        <span className="text-xs text-ink-quiet">
                          {version.uploadedBy ?? "Someone"} ·{" "}
                          {dateFormat.format(version.createdAt)}
                        </span>
                        {version.proofreaderNotes && (
                          <span className="mt-1 max-w-[60ch] rounded-[4px] bg-pending-tint px-3 py-2 text-[12px] leading-relaxed text-pending-deep">
                            Returned: {version.proofreaderNotes}
                          </span>
                        )}
                      </div>

                      <StatusPill
                        tone={PROOF_LABEL[version.status]?.tone ?? "neutral"}
                      >
                        {PROOF_LABEL[version.status]?.label ?? version.status}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

        </div>
      </PortalBody>
    </>
  );
}
