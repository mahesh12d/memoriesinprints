"use client";

import { useEffect, useRef } from "react";
import { markOrderViewedAction } from "@/lib/notifications/actions";

/**
 * Records that this order has been looked at.
 *
 * Deliberately a client effect rather than a call in the page's own render. A
 * render is not evidence that anyone looked: hovering a row in the queue
 * prefetches the order page, and a render that marked the order seen would clear
 * its "new" dot because someone's pointer crossed the link — which is exactly
 * the signal the dot exists to carry.
 *
 * It also fires again when the tab comes back to the front. Someone who left an
 * order open on a second monitor all afternoon has seen whatever arrived on it by
 * the time they look back at it, and leaving it marked new would train them to
 * ignore the mark.
 *
 * Renders nothing.
 */
export function MarkViewed({ orderId }: { orderId: string }) {
  /*
    A ref rather than a dependency, so a re-render cannot re-fire this. The
    effect runs once per order and then only on the tab coming back.
  */
  const last = useRef(0);

  useEffect(() => {
    let live = true;

    function record() {
      if (!live || document.hidden) return;

      // Two visibility events in quick succession are one return to the page,
      // not two visits worth writing.
      const now = Date.now();
      if (now - last.current < 5_000) return;
      last.current = now;

      // Nothing is shown if this fails: the page is already open and readable,
      // and a bookkeeping write is not worth an error in front of anyone. The
      // next visit records it.
      void markOrderViewedAction(orderId).catch(() => {});
    }

    record();

    function onVisibility() {
      if (!document.hidden) record();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [orderId]);

  return null;
}
