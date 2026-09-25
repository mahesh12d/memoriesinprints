import { agingLevel, waitedFor, type AgingLevel } from "@/lib/notifications/aging";

/**
 * The smallest thing on the screen and the one that does the most work: a dot
 * that means "this changed since you last looked".
 *
 * It clears when the order is opened, not when a separate button is pressed.
 * The question it answers is whether someone has seen the thing, and opening it
 * is the only honest evidence of that.
 */
export function UnseenDot({ label = "New activity" }: { label?: string }) {
  return (
    <span
      // A title on a 6px dot is not a label anyone will find, so the name is
      // read out instead and the dot itself is decoration.
      className="inline-flex size-[7px] shrink-0 rounded-full bg-brand"
      role="img"
      aria-label={label}
    />
  );
}

/** The same signal where there is room for a word. */
export function NewChip({ children = "New" }: { children?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.05em] text-on-accent">
      {children}
    </span>
  );
}

const AGING: Record<AgingLevel, { className: string; hint: string }> = {
  fresh: {
    className: "text-ink-quiet",
    hint: "",
  },
  warm: {
    className: "bg-pending-tint px-2 py-0.5 rounded-full text-pending-deep font-semibold",
    hint: "waiting over four hours",
  },
  overdue: {
    className: "bg-alert-tint px-2 py-0.5 rounded-full text-alert font-bold",
    hint: "waiting over a day",
  },
};

/**
 * How long a row has been waiting, coloured by how long that is.
 *
 * Replaces the plain grey "waiting 1 day": the studio's queue runs ten to
 * twenty deep per person and finding the cold one meant reading every line.
 * The thresholds are in lib/notifications/aging so they can be tested and so
 * the queue can sort on the same answer the badge shows.
 */
export function AgingBadge({
  since,
  now,
}: {
  since: Date;
  /**
   * Passed in by server components so the badge and the sort agree.
   *
   * Two calls to `new Date()` a few milliseconds apart can land either side of
   * a threshold, which is how a row gets lifted to the top of the queue while
   * still rendering its time in grey.
   */
  now?: Date;
}) {
  const at = now ?? new Date();
  const level = agingLevel(since, at);
  const tone = AGING[level];

  return (
    <span
      className={`inline-flex whitespace-nowrap text-[11px] ${tone.className}`}
      title={tone.hint || undefined}
    >
      waiting {waitedFor(since, at)}
    </span>
  );
}
