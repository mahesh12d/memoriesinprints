import Link from "next/link";
import {
  GROUP_LABEL,
  reasonFor,
  sortQueue,
  type QueueGroup,
  type QueueItem,
  type Viewer,
} from "@/lib/proofs/queue";
import { StatusPill, type PillTone } from "./status-pill";
import { AgingBadge, UnseenDot } from "./unseen";
import { SnoozeButton } from "./snooze-button";
import {
  snoozeOrderAction,
  unsnoozeOrderAction,
} from "@/lib/notifications/actions";

const PROOF_LABEL: Record<string, { label: string; tone: PillTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  awaiting_proofreading: { label: "Needs proofreading", tone: "pending" },
  returned_to_designer: { label: "Returned to designer", tone: "alert" },
  awaiting_customer: { label: "With the customer", tone: "neutral" },
  approved: { label: "Approved", tone: "good" },
  changes_requested: { label: "Changes requested", tone: "alert" },
};

/**
 * A queue row carries whatever loadQueue found for it; only these matter here.
 */
export type QueueRow = QueueItem & {
  customerName: string;
  designerName: string | null;
  versionNumber: number | null;
  /** The newest event's own words, preferred over the generic reason. */
  latestEvent?: string | null;
};

/**
 * What to open next, rather than how many of each thing there are.
 *
 * The studio had six counter tiles and a bucketed list, which between them
 * answered "how busy am I" and never "what should I do first" — and with ten to
 * twenty open orders each, at different steps, that second question is the whole
 * job. Every row here says whose move it is, how long it has been that way, and
 * why, so the answer is the top of the list.
 *
 * Server-rendered. Only the snooze picker is interactive, so only it crosses
 * into the client.
 */
export function MyQueueList({
  items,
  viewer,
  now,
  showSnoozed = false,
  only,
  emptyTitle = "Nothing Needs You Right Now",
  emptyBody = "Everything you are on is either with someone else or finished.",
}: {
  items: QueueRow[];
  viewer: Viewer;
  /** One clock for the sort and every badge, so they cannot disagree. */
  now: Date;
  /** Include orders this viewer set aside. */
  showSnoozed?: boolean;
  /** Show a single bucket, for when a dashboard tile has been clicked. */
  only?: QueueGroup;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const groups = sortQueue(items, viewer, {
    now,
    includeSnoozed: showSnoozed,
  }).filter((group) => (only ? group.group === only : true));

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-line bg-card p-10 text-center">
        <h2 className="font-display text-lg">{emptyTitle}</h2>
        <p className="mt-2 text-sm text-ink-muted">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.group} className="flex flex-col gap-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-quiet">
            {GROUP_LABEL[group.group]} ({group.items.length})
          </h2>

          <div className="overflow-hidden rounded-md border border-line bg-card">
            <ul>
              {group.items.map((item) => {
                const proof = item.proofStatus
                  ? PROOF_LABEL[item.proofStatus]
                  : { label: "No proof yet", tone: "pending" as PillTone };

                const snoozed =
                  item.snoozedUntil !== null &&
                  item.snoozedUntil !== undefined &&
                  item.snoozedUntil.getTime() > now.getTime();

                return (
                  <li
                    key={item.orderId}
                    /*
                      The accent bar is the unseen signal at row scale: a dot
                      beside a reference is easy to miss when you are scanning
                      twenty of them, and the left edge of a row is the one part
                      of it your eye passes on the way down.
                    */
                    className={`flex flex-wrap items-center justify-between gap-4 border-b border-line-soft py-4 pr-6 last:border-b-0 ${
                      item.unseen
                        ? "border-l-2 border-l-brand bg-brand-tint/30 pl-[22px]"
                        : "pl-6"
                    } ${snoozed ? "opacity-60" : ""}`}
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        {item.unseen && <UnseenDot />}
                        <Link
                          href={`/staff/orders/${item.orderId}`}
                          className="text-sm font-semibold hover:underline"
                        >
                          {item.reference}
                        </Link>
                      </span>

                      {/*
                        Why it is in front of you, in the words of whoever last
                        did something — falling back to a sentence derived from
                        the proof's state for an order whose events predate any
                        of this.
                      */}
                      <span className="text-xs text-ink-soft">
                        {item.latestEvent ?? reasonFor(item, viewer)}
                      </span>

                      <span className="text-[11px] text-ink-quiet">
                        {item.customerName}
                        {item.designerName
                          ? ` · ${item.designerName}`
                          : " · unassigned"}
                        {item.versionNumber ? ` · v${item.versionNumber}` : ""}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <AgingBadge since={item.waitingSince} now={now} />
                      <StatusPill tone={proof.tone}>{proof.label}</StatusPill>
                      <SnoozeButton
                        orderId={item.orderId}
                        snoozed={snoozed}
                        onSnooze={snoozeOrderAction}
                        onWake={unsnoozeOrderAction}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
