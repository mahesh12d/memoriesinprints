import { formatMoney } from "@/lib/pricing/money";

/**
 * Money taken, by month.
 *
 * Bars rather than a line, because these are separate monthly totals to
 * compare rather than a continuous quantity. One series, so no legend — the
 * heading names it. Every bar is labelled, since there are only ever six and
 * the figures are the point. The same numbers are available as a table for
 * anyone who can't read the bars.
 */
export type RevenuePoint = {
  label: string;
  amountMinor: number;
};

export function RevenueChart({ points }: { points: RevenuePoint[] }) {
  if (points.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-[15px]">Taken, Last Six Months</h2>
        <p className="text-[13px] text-ink-muted">
          Nothing has been paid for yet. Once an order is paid, it shows here.
        </p>
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.amountMinor), 1);
  const total = points.reduce((sum, point) => sum + point.amountMinor, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[15px]">Taken, Last Six Months</h2>
        <span className="text-[13px] text-ink-muted">
          <strong className="font-semibold text-blue">
            {formatMoney(total, "GBP")}
          </strong>{" "}
          in total
        </span>
      </div>

      <div className="flex h-[150px] items-end gap-2" aria-hidden="true">
        {points.map((point) => (
          <div
            key={point.label}
            className="flex h-full flex-1 flex-col justify-end gap-1.5"
          >
            <span className="text-center text-[11px] font-semibold text-ink-soft">
              {formatMoney(point.amountMinor, "GBP")}
            </span>
            <div
              className="w-full rounded-t-[4px] bg-brand-deep"
              style={{
                height: `${Math.max((point.amountMinor / max) * 100, 2)}%`,
              }}
            />
          </div>
        ))}
      </div>

      {/* A single recessive baseline rather than a grid. */}
      <div className="flex gap-2 border-t border-line pt-1.5">
        {points.map((point) => (
          <span
            key={point.label}
            className="flex-1 text-center text-[11px] text-ink-quiet"
          >
            {point.label}
          </span>
        ))}
      </div>

      <details className="text-[12px] text-ink-quiet">
        <summary className="cursor-pointer">See the figures</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 font-semibold">Month</th>
              <th className="py-1 font-semibold">Taken</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <td className="py-1">{point.label}</td>
                <td className="py-1">
                  {formatMoney(point.amountMinor, "GBP")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
