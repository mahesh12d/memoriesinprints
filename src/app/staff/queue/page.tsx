import Link from "next/link";
import { requireStaff } from "@/lib/auth/guards";
import { loadQueue } from "@/lib/proofs/staff-queries";
import { isSnoozed, type QueueGroup } from "@/lib/proofs/queue";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { MyQueueList } from "@/components/portal/my-queue";

/** The buckets a dashboard tile can send someone straight into. */
const BUCKETS: Record<string, QueueGroup> = {
  awaiting_you: "awaiting_you",
  needs_work: "needs_work",
  awaiting_customer: "awaiting_customer",
  done: "done",
};

export default async function StaffQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; snoozed?: string }>;
}) {
  const session = await requireStaff();
  const { bucket, snoozed } = await searchParams;

  const only = bucket ? BUCKETS[bucket] : undefined;
  const showSnoozed = snoozed === "1";

  const items = await loadQueue(session.user);

  /*
    One clock for the whole render.

    The sort and the badges both read how long each row has waited, and taking
    the time twice can land either side of a threshold — which shows up as a row
    lifted to the top of its bucket while its own badge still reads grey.
  */
  const now = new Date();

  const viewer = {
    id: session.user.id,
    role: session.user.role as "designer" | "proofreader",
  };

  const setAside = items.filter((item) => isSnoozed(item, now)).length;

  return (
    <>
      <PortalHeader
        title="Work Queue"
        actions={
          /*
            A way back to what was set aside. Something snoozed and then
            forgotten is worse than something never snoozed at all, so the count
            stays on screen while any are hidden.
          */
          setAside > 0 ? (
            <Link
              href={
                showSnoozed
                  ? "/staff/queue"
                  : "/staff/queue?snoozed=1"
              }
              className="text-[13px] font-semibold text-accent-text"
            >
              {showSnoozed
                ? "Hide set aside"
                : `Show ${setAside} set aside`}
            </Link>
          ) : undefined
        }
      />

      <PortalBody>
        <div className="flex flex-col gap-5">
          {only && (
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-ink-muted">
                Showing one bucket only.
              </span>
              <Link
                href="/staff/queue"
                className="text-[13px] font-semibold text-accent-text"
              >
                Show everything
              </Link>
            </div>
          )}

          <MyQueueList
            items={items}
            viewer={viewer}
            now={now}
            only={only}
            showSnoozed={showSnoozed}
            emptyTitle={only ? "Nothing in That Bucket" : "Nothing in the Queue"}
            emptyBody={
              only
                ? "Nothing of yours is at that step right now."
                : "Every order is either delivered or cancelled."
            }
          />
        </div>
      </PortalBody>
    </>
  );
}
