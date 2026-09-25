const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type ActivityEntry = {
  id: string;
  summary: string;
  createdAt: Date;
};

/**
 * Everything that has happened to one order, newest at the top.
 *
 * Folded away by default. Three people now share these screens and the
 * history is reference material — worth having to hand, not worth pushing
 * the proof and the order form down the page on every visit.
 *
 * A native <details>, so it opens with no JavaScript, is keyboard-operable
 * for free and can be printed open.
 */
export function ActivityTimeline({
  entries,
  title = "History",
  scrollable = false,
  collapsible = true,
}: {
  entries: ActivityEntry[];
  title?: string;
  /**
   * Caps the list and scrolls it instead of growing the page.
   *
   * For the places where this sits beside something being worked on rather
   * than at the foot of the page — a job with forty events would otherwise
   * push its neighbour off the screen.
   */
  scrollable?: boolean;
  /**
   * Whether it folds away.
   *
   * Beside the work it is reference you want on screen, so the disclosure is
   * a click between you and it for no gain. At the foot of a page it is worth
   * folding, which is what the default is for.
   */
  collapsible?: boolean;
}) {
  if (entries.length === 0) return null;

  // <details>/<summary> when it folds, plain boxes when it does not.
  const Shell = collapsible ? "details" : "div";
  const Head = collapsible ? "summary" : "div";

  return (
    <section className="rounded-md border border-line bg-card p-6">
      <Shell className="group">
        <Head
          className={`flex items-center justify-between gap-3 ${
            collapsible ? "cursor-pointer list-item" : ""
          }`}
        >
          <span className="font-display text-lg">{title}</span>{" "}
          <span className="text-[12px] text-ink-quiet">
            {entries.length === 1 ? "1 entry" : `${entries.length} entries`}
          </span>
        </Head>

        {/*
          The line runs down the left of the list and the markers sit on it.
          It is decoration, so it is hidden from assistive technology — the
          list is already a list, and each entry already carries its own time.
        */}
        <ol
          className={`relative mt-4 flex flex-col gap-5 pl-5 ${
            scrollable ? "max-h-[320px] overflow-y-auto pr-2" : ""
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute bottom-1 left-[3px] top-1.5 w-px bg-line"
          />

          {entries.map((entry, index) => (
            <li key={entry.id} className="relative flex flex-col gap-0.5">
              <span
                aria-hidden="true"
                className={`absolute -left-5 top-1.5 size-[7px] rounded-full ${
                  // The newest is what happened last, and is the one being
                  // looked for when someone opens this.
                  index === 0 ? "bg-brand" : "bg-line"
                }`}
              />
              <span className="text-[13px] leading-relaxed">
                {entry.summary}
              </span>
              <time
                dateTime={entry.createdAt.toISOString()}
                className="text-[11px] text-ink-quiet"
              >
                {dateTimeFormat.format(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      </Shell>
    </section>
  );
}
