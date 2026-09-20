"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { BellIcon } from "./icons";
import type { NotificationRow } from "@/lib/notifications/types";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Sits in the sidebar so it follows the customer around the portal.
 *
 * Opening the panel is what marks things read — the count is about what they
 * have looked at, not about clicking a particular line. The badge clears
 * straight away rather than waiting for the server, because the round trip is
 * only bookkeeping.
 */
export function NotificationBell({
  items,
  unreadCount,
  markRead,
}: {
  items: NotificationRow[];
  unreadCount: number;
  markRead: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const badge = seen ? 0 : unreadCount;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
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

  function toggle() {
    const next = !open;
    setOpen(next);

    if (next && unreadCount > 0 && !seen) {
      setSeen(true);
      startTransition(async () => {
        await markRead();
      });
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          badge > 0
            ? `Notifications, ${badge} unread`
            : "Notifications, none unread"
        }
        className="flex w-full items-center gap-3 rounded px-3.5 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
      >
        <span className="relative flex">
          <BellIcon />
          {badge > 0 && (
            <span className="absolute -right-1.5 -top-1.5 size-2 rounded-full bg-brand-on-dark" />
          )}
        </span>
        <span className="flex-1 text-left">Notifications</span>
        {badge > 0 && (
          <span className="rounded-full bg-brand-on-dark px-1.5 py-0.5 text-[10px] font-bold text-blue-deep">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute left-0 top-full z-30 mt-1.5 w-[290px] overflow-hidden rounded-md border border-line bg-white shadow-lg"
        >
          {items.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-muted">
              Nothing yet. We&rsquo;ll let you know when your proof is ready.
            </p>
          ) : (
            <ul className="max-h-[340px] overflow-y-auto">
              {items.map((item) => {
                const inner = (
                  <span className="flex items-start gap-2">
                    {item.isUnread && (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-deep"
                      />
                    )}
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold leading-snug">
                        {item.title}
                      </span>
                      {item.body && (
                        <span className="text-[12px] leading-relaxed text-ink-muted">
                          {item.body}
                        </span>
                      )}
                      <span className="text-[11px] text-ink-quiet">
                        {dateFormat.format(new Date(item.createdAt))}
                      </span>
                    </span>
                  </span>
                );

                return (
                  <li
                    key={item.id}
                    className="border-b border-line-soft last:border-b-0"
                  >
                    {item.linkUrl ? (
                      <Link
                        href={item.linkUrl}
                        onClick={() => setOpen(false)}
                        className="block px-4 py-3 hover:bg-surface-grey"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
