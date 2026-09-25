"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { bundleNote } from "@/lib/notifications/bundle";
import type { NotificationGroup } from "@/lib/notifications/types";
import { waitedFor } from "@/lib/notifications/aging";

/**
 * One line of news, used by the bell panel and by the dashboard feed so the two
 * cannot drift apart in wording or in what counts as unread.
 *
 * A row is always a link where there is anywhere to go. The point of a
 * notification is the thing it is about, and a notification you can only read is
 * a notification you then have to go and find.
 */
export function NotificationRow({
  group,
  onOpen,
  trailing,
}: {
  group: NotificationGroup;
  /** Closes the panel, and clears the row, when it is followed. */
  onOpen?: () => void;
  /** A mark-read control, where the surface offers one. */
  trailing?: ReactNode;
}) {
  const note = bundleNote(group);

  const body = (
    <span className="flex items-start gap-2">
      {group.isUnread && (
        <span
          aria-hidden="true"
          className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand"
        />
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className={`text-[13px] leading-snug ${
            group.isUnread ? "font-semibold" : "font-medium text-ink-soft"
          }`}
        >
          {group.title}
        </span>

        {group.body && (
          <span className="text-[12px] leading-relaxed text-ink-muted">
            {group.body}
          </span>
        )}

        <span className="text-[11px] text-ink-quiet">
          {waitedFor(new Date(group.createdAt))} ago
          {/*
            What the fold swallowed. Ten pages uploaded to one order reads as
            one line, but the line has to admit there were ten — otherwise the
            other nine are simply missing.
          */}
          {note && <span className="text-ink-quiet"> · {note}</span>}
        </span>
      </span>
    </span>
  );

  return (
    <li className="flex items-start gap-1 border-b border-line-soft last:border-b-0">
      {group.linkUrl ? (
        <Link
          href={group.linkUrl}
          onClick={onOpen}
          className={`block min-w-0 flex-1 px-4 py-3 hover:bg-surface-grey ${
            group.isUnread ? "bg-brand-tint/25" : ""
          }`}
        >
          {body}
        </Link>
      ) : (
        <div className="min-w-0 flex-1 px-4 py-3">{body}</div>
      )}
      {trailing && <div className="shrink-0 py-3 pr-3">{trailing}</div>}
    </li>
  );
}
