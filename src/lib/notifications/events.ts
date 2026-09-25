import "server-only";

import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  notifications,
  orders,
  orderWatchers,
  proofVersions,
  users,
} from "@/db/schema";
import type { EventAudience } from "@/db/schema";

/**
 * One way in for "something happened on this order".
 *
 * Every state change used to write its own history string, and separately
 * decide whether to tell anyone — which is why the studio had plenty of state
 * and no signal: a proof could come back from a customer and the only trace
 * was a sentence in a list nobody had a reason to re-read. Recording an event
 * here does three things at once, so none of them can be forgotten at a call
 * site:
 *
 *   1. appends to the order's timeline,
 *   2. bumps the order's lastActivityAt, which is what "new since you last
 *      looked" compares against,
 *   3. fans the event out to the people it is waiting on.
 *
 * Fan-out happens on write rather than being worked out when the bell is
 * opened. The bell is in every layout, so it runs on every page load of the
 * whole product; it has to stay one indexed select.
 */

/**
 * The studio's event vocabulary.
 *
 * These strings are already in the database on rows written before any of
 * this, and a summary is never rewritten, so the names stay as they were
 * rather than being tidied into a new set that would split the history in two.
 */
export type OrderEventType =
  | "order_raised"
  | "order_status"
  | "payment_recorded"
  | "designer_assigned"
  | "proof_uploaded"
  | "proof_submitted"
  | "proof_sent"
  | "proof_returned"
  | "proof_approved"
  | "proof_archived"
  | "changes_requested"
  | "comment_added";

/** Where each audience reads an order, for the link on a bell row. */
function defaultLink(audience: EventAudience, orderId: string): string {
  switch (audience) {
    case "customer":
      return `/account/orders/${orderId}`;
    case "admin":
      return `/admin/orders/${orderId}`;
    default:
      return `/staff/orders/${orderId}`;
  }
}

/**
 * Who is told, given whose move it is next.
 *
 * A designer means the one the order is assigned to, not every designer: work
 * they cannot open is not work they can be waiting on. A proofreader means
 * whoever last checked this order, so a job stays with the person who knows
 * it, and falls back to all of them when it has never been checked — an
 * unchecked proof needs *a* proofreader, and picking one arbitrarily here
 * would quietly assign work.
 */
async function recipients(
  orderId: string,
  audience: EventAudience,
  actorId: string | null,
): Promise<string[]> {
  const found: (string | null)[] = [];

  if (audience === "customer" || audience === "designer") {
    const [order] = await db
      .select({
        userId: orders.userId,
        assignedDesignerId: orders.assignedDesignerId,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) return [];
    found.push(audience === "customer" ? order.userId : order.assignedDesignerId);
  }

  if (audience === "proofreader") {
    const [last] = await db
      .select({ proofreaderId: proofVersions.proofreaderId })
      .from(proofVersions)
      .where(eq(proofVersions.orderId, orderId))
      .orderBy(sql`${proofVersions.versionNumber} desc`)
      .limit(1);

    if (last?.proofreaderId) {
      found.push(last.proofreaderId);
    } else {
      const all = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "proofreader"));
      found.push(...all.map((row) => row.id));
    }
  }

  if (audience === "admin") {
    const all = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"));
    found.push(...all.map((row) => row.id));
  }

  // Nobody needs telling about something they just did themselves.
  return [
    ...new Set(
      found.filter((id): id is string => Boolean(id) && id !== actorId),
    ),
  ];
}

export type RecordedEvent = {
  orderId: string;
  /** Who did it. Null for a system event — an archive sweep, a webhook. */
  actorId?: string | null;
  type: OrderEventType;
  /** The timeline sentence, in the studio's words. Never rewritten. */
  summary: string;
  meta?: Record<string, unknown> | null;
  /**
   * Whose move it is next, if it is anyone's.
   *
   * Leave it off for a matter of record: it then lands on the timeline and
   * bumps the order, but rings no bell and puts nothing in anyone's queue.
   */
  audience?: EventAudience | null;
  /**
   * What the bell says, when the summary is not what this audience should
   * read.
   *
   * The timeline is written for the studio ("Sam sent version 3 of MP-1060 to
   * the customer"); the customer's own bell should not be told about Sam. Left
   * off, the summary is used as-is, which is right for a handover between two
   * people on the same floor.
   */
  notify?: Omit<Tell, "audience">;
  /**
   * Other people who want to know, in their own words.
   *
   * Whose move it is is one person's — the designer's, when a customer marks
   * pages — but the proofreader routes that work and would otherwise find out
   * by noticing. They are told without the order landing in their queue as
   * theirs to fix, and without a second sentence appearing in the history: one
   * thing happened, so the timeline gets one row.
   */
  alsoTell?: Tell[];
};

/** One audience's wording for an event. */
export type Tell = {
  audience: EventAudience;
  title: string;
  body?: string | null;
  /** Defaults to order_status, the catch-all for "your order moved". */
  kind?: "proof_ready" | "order_status" | "quote_update" | "system";
  link?: string;
};

export async function recordOrderEvent(event: RecordedEvent): Promise<void> {
  const actorId = event.actorId ?? null;

  const [row] = await db
    .insert(activityEvents)
    .values({
      orderId: event.orderId,
      actorId,
      type: event.type,
      summary: event.summary,
      meta: event.meta ?? null,
      audience: event.audience ?? null,
    })
    .returning({ id: activityEvents.id, createdAt: activityEvents.createdAt });

  /*
    The order's own clock, moved by activity rather than by editing.

    updatedAt already moves when someone corrects a production note, which is
    not something to tell anyone about — so it cannot be the column the unseen
    markers read.
  */
  await db
    .update(orders)
    .set({ lastActivityAt: row.createdAt })
    .where(eq(orders.id, event.orderId));

  const tells: Tell[] = [
    ...(event.audience
      ? [
          {
            audience: event.audience,
            title: event.notify?.title ?? event.summary,
            body: event.notify?.body ?? null,
            kind: event.notify?.kind,
            link: event.notify?.link,
          },
        ]
      : []),
    ...(event.alsoTell ?? []),
  ];

  if (tells.length === 0) return;

  const rows: (typeof notifications.$inferInsert)[] = [];
  const told = new Set<string>();

  for (const tell of tells) {
    for (const userId of await recipients(
      event.orderId,
      tell.audience,
      actorId,
    )) {
      // One row per person even where two audiences overlap — a proofreader
      // who is also watching as an admin gets told once.
      if (told.has(userId)) continue;
      told.add(userId);

      rows.push({
        userId,
        orderId: event.orderId,
        eventId: row.id,
        type: tell.kind ?? "order_status",
        title: tell.title,
        body: tell.body ?? null,
        linkUrl: tell.link ?? defaultLink(tell.audience, event.orderId),
      });
    }
  }

  if (rows.length === 0) return;

  await db.insert(notifications).values(rows);

  /*
    New activity supersedes a snooze.

    Someone who set an order aside for the afternoon did so knowing what it
    said then. A customer coming back with changes is a different order from
    the one they snoozed, so it returns to their queue rather than staying
    hidden until the timer runs out.
  */
  await db
    .update(orderWatchers)
    .set({ snoozedUntil: null })
    .where(
      and(
        eq(orderWatchers.orderId, event.orderId),
        isNotNull(orderWatchers.snoozedUntil),
        inArray(orderWatchers.userId, [...told]),
      ),
    );
}

/**
 * A plain record with no order attached — a role change, an invitation.
 *
 * Kept here so the studio's activity panel has one writer, even for the things
 * that are nobody's move.
 */
export async function recordStudioEvent(event: {
  actorId?: string | null;
  type: string;
  summary: string;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(activityEvents).values({
    orderId: null,
    actorId: event.actorId ?? null,
    type: event.type,
    summary: event.summary,
    meta: event.meta ?? null,
  });
}
