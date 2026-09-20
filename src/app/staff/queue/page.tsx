import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { loadQueue } from "@/lib/proofs/staff-queries";
import { GROUP_LABEL, sortQueue } from "@/lib/proofs/queue";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { StatusPill, type PillTone } from "@/components/portal/status-pill";

const PROOF_LABEL: Record<string, { label: string; tone: PillTone }> = {
  awaiting_proofreading: { label: "Needs proofreading", tone: "pending" },
  returned_to_designer: { label: "Returned to designer", tone: "alert" },
  awaiting_customer: { label: "With the customer", tone: "neutral" },
  approved: { label: "Approved", tone: "good" },
  changes_requested: { label: "Changes requested", tone: "alert" },
};

function waitedFor(since: Date): string {
  const days = Math.floor((Date.now() - since.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default async function StaffQueuePage() {
  const session = await requireStaff();
  const items = await loadQueue();

  const groups = sortQueue(
    items.map((item) => ({ ...item, waitingSince: item.waitingSince })),
    { id: session.user.id, role: session.user.role as "designer" | "proofreader" },
  );

  return (
    <>
      <PortalHeader title="Work queue" />
      <PortalBody>
        {groups.length === 0 ? (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <h2 className="font-display text-lg">Nothing in the queue</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Every order is either delivered or cancelled.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((group) => (
              <section key={group.group} className="flex flex-col gap-3">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-quiet">
                  {GROUP_LABEL[group.group]} ({group.items.length})
                </h2>

                <div className="overflow-hidden rounded-md border border-line bg-white">
                  <ul>
                    {group.items.map((item) => {
                      const proof = item.proofStatus
                        ? PROOF_LABEL[item.proofStatus]
                        : { label: "No proof yet", tone: "pending" as PillTone };

                      return (
                        <li
                          key={item.orderId}
                          className="flex flex-wrap items-center justify-between gap-4 border-b border-line-soft px-6 py-4 last:border-b-0"
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <Link
                              href={`/staff/orders/${item.orderId}`}
                              className="text-sm font-semibold hover:underline"
                            >
                              {item.reference}
                            </Link>
                            <span className="text-xs text-ink-quiet">
                              {item.customerName}
                              {item.designerName
                                ? ` · ${item.designerName}`
                                : " · unassigned"}
                              {item.versionNumber
                                ? ` · v${item.versionNumber}`
                                : ""}
                            </span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-xs text-ink-quiet">
                              waiting {waitedFor(item.waitingSince)}
                            </span>
                            <StatusPill tone={proof.tone}>
                              {proof.label}
                            </StatusPill>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </div>
        )}
      </PortalBody>
    </>
  );
}
