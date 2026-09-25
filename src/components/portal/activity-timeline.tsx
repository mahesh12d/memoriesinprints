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
}: {
  entries: ActivityEntry[];
  title?: string;
}) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-md border border-line bg-card p-6">
      <details className="group">
        <summary className="flex cursor-pointer list-item items-center justify-between gap-3">
          <span className="font-display text-lg">{title}</span>{" "}
          <span className="text-[12px] text-ink-quiet">
            {entries.length === 1 ? "1 entry" : `${entries.length} entries`}
          </span>
        </summary>

        {/*
          The line runs down the left of the list and the markers sit on it.
          It is decoration, so it is hidden from assistive technology — the
          list is already a list, and each entry already carries its own time.
        */}
        <ol className="relative mt-4 flex flex-col gap-5 pl-5">
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
      </details>
    </section>
  );
}
