"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellIcon } from "./icons";
import { NotificationRow } from "./notification-row";
import { agingLevel } from "@/lib/notifications/aging";
import { useOrderUpdates } from "@/lib/realtime";
import type { Digest, NotificationGroup } from "@/lib/notifications/types";

/**
 * The bell, in every layout — staff, admin and customer alike.
 *
 * It used to exist only in the customer's sidebar, which meant the two people
 * who hand work to each other all day, the designer and the proofreader, had no
 * signal at all: a proof could come back with changes and the only way to find
 * out was to be on the right page and notice a row had moved. Anyone in the loop
 * can now be told from wherever they are.
 *
 * Opening the panel is what marks things read. The count is about what they have
 * looked at, not about clicking a particular line, and the badge clears straight
 * away rather than waiting for the server — the round trip is only bookkeeping.
 */
export function NotificationBell({
  items,
  unreadCount,
  markRead,
  markOneRead,
  readDigest,
}: {
  items: NotificationGroup[];
  unreadCount: number;
  markRead: () => Promise<void>;
  markOneRead: (id: string) => Promise<void>;
  /** The cheap poll, so the badge moves without a navigation. */
  readDigest: () => Promise<Digest>;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  const [cleared, setCleared] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const badge = seen ? 0 : unreadCount;

  /*
    Live without a refresh.

    Everything the bell draws was decided when the page was built, so a proof
    arriving while someone sits on their queue used to leave the badge at
    whatever it said when they got there. The poll asks a two-aggregate question
    and only refreshes the route when the answer has actually moved.
  */
  const onChange = useCallback(() => {
    // New news means the badge is no longer what they have seen.
    setSeen(false);
    setCleared([]);
    router.refresh();
  }, [router]);

  useOrderUpdates({
    read: readDigest,
    onChange,
    since: { unreadCount, latestEventAt: items[0]?.createdAt
      ? new Date(items[0].createdAt).getTime()
      : null },
  });

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

  /*
    Red rather than the house colour when something has gone cold.

    A count on its own says how much is waiting, not whether any of it is late,
    so a badge reading 3 looks the same whether all three arrived this minute or
    one has sat since yesterday.
  */
  const urgent = items.some(
    (group) =>
      group.isUnread && agingLevel(new Date(group.createdAt)) === "overdue",
  );

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
            <span
              className={`absolute -right-1.5 -top-1.5 size-2 rounded-full ${
                urgent ? "bg-alert" : "bg-brand-on-dark"
              }`}
            />
          )}
        </span>
        <span className="flex-1 text-left">Notifications</span>
        {badge > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              urgent
                ? "bg-alert text-white"
                : "bg-brand-on-dark text-blue-deep"
            }`}
          >
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute left-0 top-full z-30 mt-1.5 w-[320px] overflow-hidden rounded-md border border-line bg-card shadow-lg"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-quiet">
              Notifications
            </span>
            {items.some((group) => group.isUnread) && (
              <button
                type="button"
                onClick={() => {
                  setSeen(true);
                  setCleared(items.flatMap((group) => group.ids));
                  startTransition(async () => {
                    await markRead();
                  });
                }}
                className="text-[12px] font-semibold text-accent-text hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-ink-muted">
              Nothing needs you right now. We&rsquo;ll let you know the moment
              something does.
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto">
              {items.map((group) => {
                // Optimistically read, so a clicked line stops looking new
                // before the server has caught up.
                const shown = {
                  ...group,
                  isUnread:
                    group.isUnread &&
                    !seen &&
                    !group.ids.every((id) => cleared.includes(id)),
                };

                return (
                  <NotificationRow
                    key={group.id}
                    group={shown}
                    onOpen={() => setOpen(false)}
                    trailing={
                      shown.isUnread ? (
                        <button
                          type="button"
                          aria-label="Mark as read"
                          title="Mark as read"
                          onClick={() => {
                            setCleared((was) => [...was, ...group.ids]);
                            startTransition(async () => {
                              // A folded line stands for several rows, so
                              // clearing it has to clear all of them.
                              await Promise.all(group.ids.map(markOneRead));
                            });
                          }}
                          className="rounded-full p-1 text-ink-quiet hover:bg-surface-grey hover:text-ink"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className="size-3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 8.5 6.5 12 13 4.5" />
                          </svg>
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
