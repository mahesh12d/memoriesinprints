"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import type { Digest } from "@/lib/notifications/types";

/**
 * The one seam between "something changed" and the screens that care.
 *
 * Nobody in a modern tool presses refresh to find out whether a proof arrived,
 * and this app had no way to tell them: the data was fresh the moment the page
 * was built and then sat there. Every live surface subscribes here and nowhere
 * else, so how the news actually travels is one module's business.
 *
 * Today it polls. The studio runs on serverless Postgres, where a connection
 * held open per viewer for LISTEN/NOTIFY is the wrong shape, and a timer
 * against one indexed query needs no infrastructure that does not already
 * exist. The cost is that "live" means within a few seconds rather than
 * instantly.
 *
 * Swapping in a stream later means reimplementing this function and nothing
 * else: an EventSource against a route handler that pushes when an event is
 * recorded, with the same signature and the same callback. No caller changes.
 */

/** How often to ask, when the tab is being looked at. */
const INTERVAL_MS = 12_000;

export type OrderUpdatesOptions = {
  /** Reads the current digest. A server action, passed in by the caller. */
  read: () => Promise<Digest>;
  /**
   * Called when something has actually changed since the last look — not on
   * every poll. Wired to router.refresh() by the mounting component.
   */
  onChange: (digest: Digest) => void;
  /** Where the subscriber is starting from, so the first poll is not a change. */
  since: Digest;
};

/**
 * Subscribes for the lifetime of the calling component.
 *
 * Two things keep this quiet. Polling stops while the tab is hidden, because a
 * backgrounded queue is nobody's live view — and resumes with an immediate
 * check, since that is exactly the moment someone has come back to it and wants
 * what they missed. And onChange only fires when the digest genuinely moved, so
 * a quiet afternoon costs one small query every twelve seconds and no
 * re-renders at all.
 */
export function useOrderUpdates({
  read,
  onChange,
  since,
}: OrderUpdatesOptions): void {
  /*
    What the next poll is compared against. A ref rather than state: moving it
    must not re-render anything by itself, and the render that follows is the
    caller's to trigger.
  */
  const seen = useRef<Digest>(since);

  /*
    The poll itself is an Effect Event, so the effect below depends on nothing
    that changes per render.

    Without this the effect would list read and onChange as dependencies, both
    of which are new identities on every render — and an interval torn down and
    restarted on every render is an interval that never fires.
  */
  const poll = useEffectEvent(async () => {
    if (document.hidden) return;

    let digest: Digest;
    try {
      digest = await read();
    } catch {
      // A dropped poll is not worth telling anyone about: the next one is
      // twelve seconds away, and a failed background check must never put an
      // error in front of someone reading their queue.
      return;
    }

    const before = seen.current;
    const moved =
      digest.latestEventAt !== before.latestEventAt ||
      digest.unreadCount !== before.unreadCount;

    if (!moved) return;

    seen.current = digest;
    onChange(digest);
  });

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;

    function check() {
      if (!live) return;
      void poll();
    }

    function start() {
      timer ??= setInterval(check, INTERVAL_MS);
    }

    function stop() {
      if (timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    }

    function onVisibility() {
      if (document.hidden) {
        stop();
        return;
      }
      // Back on screen: catch up first, then resume the timer.
      void check();
      start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      live = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
