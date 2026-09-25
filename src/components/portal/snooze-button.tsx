"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { SnoozeFor } from "@/lib/notifications/actions";

const OPTIONS: { value: SnoozeFor; label: string }[] = [
  { value: "1h", label: "For an hour" },
  { value: "4h", label: "For four hours" },
  { value: "tomorrow", label: "Until tomorrow morning" },
];

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.2l2.2 1.3" />
    </svg>
  );
}

/**
 * Sets a row aside without pretending it is handled.
 *
 * The middle state a read/unread flag has nowhere to put: someone has seen the
 * order, knows what it says, and is not going to get to it before three. Left
 * with only "new" and "not new" they either leave it marked new — and stop
 * trusting the marker, because most of what is marked is not actually news — or
 * clear it and lose it. This drops it out of the default view and brings it back
 * on its own.
 *
 * It does not survive new activity: see recordOrderEvent, where anything
 * happening on the order cancels the snooze. What they set aside was the order
 * as it stood, not the one the customer has since commented on.
 */
export function SnoozeButton({
  orderId,
  snoozed,
  onSnooze,
  onWake,
}: {
  orderId: string;
  /** Already set aside, so the control offers to bring it back instead. */
  snoozed?: boolean;
  onSnooze: (orderId: string, until: SnoozeFor) => Promise<void>;
  onWake: (orderId: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (snoozed) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => { await onWake(orderId); })}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface-grey disabled:opacity-50"
      >
        <ClockIcon />
        Snoozed — bring back
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Set this order aside"
        className="inline-flex items-center rounded-full border border-line p-1.5 text-ink-quiet hover:bg-surface-grey hover:text-ink disabled:opacity-50"
      >
        <ClockIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-[210px] overflow-hidden rounded-md border border-line bg-card shadow-lg"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await onSnooze(orderId, option.value);
                });
              }}
              className="block w-full px-3.5 py-2.5 text-left text-[13px] hover:bg-surface-grey"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
