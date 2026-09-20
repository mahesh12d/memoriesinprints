/**
 * Weekly average approval time.
 *
 * One series, so no legend — the heading names it. The line uses the deeper
 * green rather than the brand green, because a 2px mark of #2DBC9A on white
 * measures 2.39:1 and would be hard to follow; #20846C clears the 3:1 floor
 * for graphical objects. Only the latest point is labelled, and the same
 * numbers are available as a table for anyone who can't read the line.
 */
export type TurnaroundPoint = {
  label: string;
  /** Average days from proof sent to customer decision. */
  days: number | null;
};

export function TurnaroundSparkline({
  points,
}: {
  points: TurnaroundPoint[];
}) {
  const withData = points.filter(
    (point): point is { label: string; days: number } => point.days !== null,
  );

  if (withData.length < 2) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[15px]">Turnaround, last 8 weeks</h2>
        <p className="text-[13px] text-ink-muted">
          Not enough approvals yet to show a trend.
        </p>
      </div>
    );
  }

  const WIDTH = 520;
  const HEIGHT = 120;
  const PAD = 10;

  const values = withData.map((point) => point.days);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const flat = max === min;

  const x = (index: number) =>
    PAD + (index * (WIDTH - PAD * 2)) / (withData.length - 1);
  // A run of identical weeks would otherwise sit flat on the baseline and read
  // as an empty chart. Centre it instead: the figure beside the heading says
  // what it is.
  const y = (value: number) =>
    flat
      ? HEIGHT / 2
      : HEIGHT - PAD - ((value - min) / (max - min)) * (HEIGHT - PAD * 2);

  const path = withData
    .map((point, index) => `${x(index)},${y(point.days)}`)
    .join(" ");

  const latest = withData.at(-1)!;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[15px]">Turnaround, last 8 weeks</h2>
        <span className="text-[13px] text-ink-muted">
          <strong className="font-semibold text-blue">
            {latest.days.toFixed(1)} days
          </strong>{" "}
          this week
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-[120px] w-full"
        role="img"
        aria-label={`Average approval time by week: ${withData
          .map((point) => `${point.label}, ${point.days.toFixed(1)} days`)
          .join("; ")}`}
      >
        {/* A single recessive baseline rather than a grid. */}
        <line
          x1={PAD}
          y1={HEIGHT - PAD}
          x2={WIDTH - PAD}
          y2={HEIGHT - PAD}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-brand-deep)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={x(withData.length - 1)}
          cy={y(latest.days)}
          r="4.5"
          fill="var(--color-brand-deep)"
          stroke="var(--color-surface)"
          strokeWidth="2"
        />
      </svg>

      <div className="flex justify-between text-[11px] text-ink-quiet">
        <span>{withData[0].label}</span>
        <span>{latest.label}</span>
      </div>

      <details className="text-[12px] text-ink-quiet">
        <summary className="cursor-pointer">See the figures</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-semibold">Week</th>
              <th className="py-1 font-semibold">Average days</th>
            </tr>
          </thead>
          <tbody>
            {withData.map((point) => (
              <tr key={point.label}>
                <td className="py-1">{point.label}</td>
                <td className="py-1">{point.days.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
