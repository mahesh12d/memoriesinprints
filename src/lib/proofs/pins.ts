/**
 * Where a comment sits on a proof.
 *
 * Positions are stored as a percentage of the rendered artwork, not pixels,
 * so a pin stays on the same word whether the proof is viewed on a phone, a
 * studio monitor, or re-rendered at a different zoom.
 */

/** Keeps a pin far enough inside the edge that its marker stays visible. */
const MIN = 1.5;
const MAX = 98.5;

export type Pin = { xPct: number; yPct: number };

export function clampPin(xPct: number, yPct: number): Pin {
  return {
    xPct: Math.min(MAX, Math.max(MIN, xPct)),
    yPct: Math.min(MAX, Math.max(MIN, yPct)),
  };
}

/**
 * Turns a click into a position on the artwork. Takes the rectangle rather
 * than the element so it can be tested without a DOM.
 */
export function pinFromClick(
  click: { clientX: number; clientY: number },
  rect: { left: number; top: number; width: number; height: number },
): Pin | null {
  if (rect.width <= 0 || rect.height <= 0) return null;

  return clampPin(
    ((click.clientX - rect.left) / rect.width) * 100,
    ((click.clientY - rect.top) / rect.height) * 100,
  );
}

/** Pins are numbered in the order they were left, so notes can refer to them. */
export function numberPins<T extends { createdAt: Date }>(
  comments: T[],
): (T & { pinNumber: number })[] {
  return [...comments]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((comment, index) => ({ ...comment, pinNumber: index + 1 }));
}
