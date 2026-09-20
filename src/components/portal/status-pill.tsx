import type { ReactNode } from "react";

export type PillTone = "good" | "pending" | "alert" | "neutral";

const TONES: Record<PillTone, string> = {
  good: "bg-good-tint text-good-deep",
  pending: "bg-brand-tint text-accent-text",
  alert: "bg-alert-tint text-alert",
  neutral: "bg-surface-grey text-ink-muted",
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
