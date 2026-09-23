/**
 * The shared look of a progress line: numbered dots, a connector that fills as
 * far as the work has got, and one plain sentence underneath saying what is
 * happening now.
 *
 * Only the drawing lives here. What the steps are and which one is current is
 * decided by the caller, because the customer and the studio are watching two
 * different things — see order-progress.tsx and staff-progress.tsx.
 *
 * Deliberately not a tablist and deliberately not interactive: nobody moves an
 * order along by clicking on this, so making the steps buttons would announce
 * them to a screen reader as choices and offer a click that does nothing. It
 * is an ordered list with aria-current on the stage in progress, and it needs
 * no JavaScript on the client at all.
 */

function Tick() {
  return (
    <svg
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6.5 5 9l4.5-5" />
    </svg>
  );
}

export function ProgressSteps({
  steps,
  current,
  note,
  label,
}: {
  steps: readonly string[];
  /** Index of the step in progress. Pass steps.length when it is all done. */
  current: number;
  note: string;
  label: string;
}) {
  return (
    <div className="@container flex flex-col gap-2.5">
      {/* The labels are absolute, so the row reserves their height itself. */}
      <ol aria-label={label} className="flex items-center pb-[18px]">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const last = index === steps.length - 1;

          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              /*
                The label below is positioned absolutely rather than sitting in
                this row. In the flow its nowrap width consumed the whole step
                and squeezed every connector to nothing — the line simply never
                appeared.
              */
              className={`relative ${last ? "shrink-0" : "flex-1"}`}
            >
              <span className="flex items-center">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-good-deep text-white"
                      : active
                        ? "bg-brand text-on-accent"
                        : "bg-surface-grey text-ink-pale"
                  }`}
                >
                  {done ? <Tick /> : index + 1}
                </span>

                {/*
                  The connector belongs to the step on its left and is filled
                  only once that step is behind us, so the line always stops at
                  the stage the work has actually reached.
                */}
                {!last && (
                  <span
                    aria-hidden="true"
                    className={`mx-1.5 h-0.5 flex-1 rounded-full ${
                      done ? "bg-good-deep" : "bg-line"
                    }`}
                  />
                )}
              </span>

              {/*
                Six labels need roughly 400px between them; below that they
                collide and the last two print on top of each other. The
                breakpoint is a container query rather than a viewport one
                because what matters is how wide this component is, not the
                window — it sits inside a card, in a portal with a sidebar, so
                the two are not the same number.

                Under that width only the stage in progress is named. The
                sentence underneath carries the meaning either way.

                The last label is anchored right so it cannot run off the edge.
              */}
              <span
                className={`absolute top-[26px] whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.06em] ${
                  last ? "right-0" : "left-0"
                } ${active ? "block" : "hidden @lg:block"} ${
                  done || active ? "text-ink-soft" : "text-ink-pale"
                }`}
              >
                {step}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-[13px] text-ink-muted" role="status">
        {note}
      </p>
    </div>
  );
}
