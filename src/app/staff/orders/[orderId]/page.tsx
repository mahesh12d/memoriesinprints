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
import { requireStaff } from "@/lib/auth/guards";
import { loadDesigners } from "@/lib/proofs/staff-queries";
import { signedReadUrl } from "@/lib/storage/storage";
import { formatMoney } from "@/lib/pricing/money";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill, type PillTone } from "@/components/portal/status-pill";
import {
  AssignDesignerForm,
  ProofreaderActions,
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

  const [versions, designers, activity] = await Promise.all([
    db
      .select({
        id: proofVersions.id,
        versionNumber: proofVersions.versionNumber,
        status: proofVersions.status,
        storageKey: proofVersions.storageKey,
        fileName: proofVersions.fileName,
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

  const currentFileUrl = current ? await signedReadUrl(current.storageKey) : null;

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
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex flex-col gap-6">
            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-lg">Upload a proof</h2>
              <p className="mb-5 mt-1 text-[13px] text-ink-muted">
                Each upload becomes a new version. Nothing is overwritten.
              </p>
              <UploadProofForm orderId={order.id} />
            </section>

            {current && canProofread && current.status === "awaiting_proofreading" && (
              <section className="rounded-md border border-line bg-white p-6">
                <h2 className="font-display text-lg">Proofread version {current.versionNumber}</h2>
                <p className="mb-5 mt-1 text-[13px] text-ink-muted">
                  Check it, then either send it on or return it.
                </p>
                <ProofreaderActions orderId={order.id} />
              </section>
            )}

            {comments.length > 0 && (
              <section className="overflow-hidden rounded-md border border-line bg-white">
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

            <section className="overflow-hidden rounded-md border border-line bg-white">
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

          <aside className="flex h-fit flex-col gap-6">
            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-lg">Order</h2>
              <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Customer</dt>
                  <dd className="text-right font-semibold">
                    {order.customerName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Total</dt>
                  <dd className="font-semibold">
                    {order.totalMinor !== null
                      ? formatMoney(order.totalMinor, order.currency)
                      : "—"}
                  </dd>
                </div>
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

              {currentFileUrl && (
                <a
                  href={currentFileUrl}
                  className="mt-4 inline-flex text-[13px] font-semibold text-accent-text"
                >
                  Open the current proof
                </a>
              )}
            </section>

            <section className="rounded-md border border-line bg-white p-6">
              <h2 className="font-display text-lg">Assignment</h2>
              <div className="mt-4">
                {canProofread ? (
                  <AssignDesignerForm
                    orderId={order.id}
                    designers={designers}
                    currentDesignerId={order.assignedDesignerId}
                  />
                ) : (
                  <p className="text-[13px] text-ink-muted">
                    {designers.find((d) => d.id === order.assignedDesignerId)
                      ?.name ?? "Unassigned"}
                    . Only a proofreader or admin can change this.
                  </p>
                )}
              </div>
            </section>

            {activity.length > 0 && (
              <section className="rounded-md border border-line bg-white p-6">
                <h2 className="font-display text-lg">Recent activity</h2>
                <ul className="mt-3 flex flex-col gap-3">
                  {activity.map((event) => (
                    <li key={event.id} className="flex flex-col gap-0.5">
                      <span className="text-[13px] leading-relaxed">
                        {event.summary}
                      </span>
                      <span className="text-[11px] text-ink-quiet">
                        {dateFormat.format(event.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </PortalBody>
    </>
  );
}
