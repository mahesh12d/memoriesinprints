import type { ReactNode } from "react";

export type PillTone = "good" | "pending" | "alert" | "neutral";

const TONES: Record<PillTone, string> = {
  good: "bg-sage-tint text-sage-deep",
  pending: "bg-warm-tint text-warm",
  alert: "bg-rose-tint text-rose-deep",
  neutral: "bg-line-warm text-ink-muted",
};

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: PillTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
