/**
 * How long something has been waiting, and how loudly to say so. Kept free of
 * database and React imports so the thresholds can be tested on their own.
 *
 * The queue used to render "waiting 1 day" as plain grey text beside "waiting
 * today", which asks whoever is reading to compare ten or twenty timestamps in
 * their head to find the one that has gone cold. Age is a colour here, so the
 * overdue row is the one that looks overdue.
 */

export type AgingLevel = "fresh" | "warm" | "overdue";

/** Four hours, then a day: a morning's grace, then a working day's. */
const WARM_MS = 4 * 60 * 60_000;
const OVERDUE_MS = 24 * 60 * 60_000;

export function agingLevel(since: Date, now: Date = new Date()): AgingLevel {
  const waited = now.getTime() - since.getTime();
  if (waited >= OVERDUE_MS) return "overdue";
  if (waited >= WARM_MS) return "warm";
  return "fresh";
}

/**
 * How long it has waited, in the shortest true form.
 *
 * Minutes for the first hour, because "waiting 0h" reads as a bug on something
 * that arrived two minutes ago. Days once there are whole ones, because by then
 * the hours are noise.
 */
export function waitedFor(since: Date, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - since.getTime());
  const minutes = Math.floor(ms / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

/**
 * Whether age alone should lift a row above its neighbours.
 *
 * Only the overdue ones jump. Sorting every row by age would undo the bucket
 * ordering that tells someone whose move it is; lifting just the cold ones
 * keeps that and still puts the bad day at the top.
 */
export function jumpsQueue(level: AgingLevel): boolean {
  return level === "overdue";
}
