import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityEvents,
  orders,
  orderWatchers,
  proofVersions,
  users,
} from "@/db/schema";
import { canSeeAllOrders } from "@/lib/auth/guards";
import type { UserRole } from "@/db/schema";

/**
 * One query for the whole queue: every order with the state of its newest
 * proof, rather than a lookup per row.
 *
 * Scoped to the viewer. A designer's queue is their own assigned work; the
 * filter is applied in SQL rather than after the fetch, so another designer's
 * orders are never loaded in the first place.
 */
export async function loadQueue(viewer: { id: string; role: UserRole }) {
  const latest = db
    .select({
      orderId: proofVersions.orderId,
      status: proofVersions.status,
      versionNumber: proofVersions.versionNumber,
      createdAt: proofVersions.createdAt,
      proofreadAt: proofVersions.proofreadAt,
      customerDecisionAt: proofVersions.customerDecisionAt,
      rank: sql<number>`row_number() over (
        partition by ${proofVersions.orderId}
        order by ${proofVersions.versionNumber} desc
      )`.as("rank"),
    })
    .from(proofVersions)
    .as("latest");

  /**
   * The newest thing to have happened on each order, for the "why it's here"
   * line on a queue row.
   *
   * A status pill says what state the proof is in; this says what someone did.
   * Same shape as the proof join above — one window pass rather than a query
   * per row, because the queue is the page a studio of three sits on all day.
   */
  const event = db
    .select({
      orderId: activityEvents.orderId,
      summary: activityEvents.summary,
      type: activityEvents.type,
      audience: activityEvents.audience,
      createdAt: activityEvents.createdAt,
      rank: sql<number>`row_number() over (
        partition by ${activityEvents.orderId}
        order by ${activityEvents.createdAt} desc
      )`.as("rank"),
    })
    .from(activityEvents)
    .as("event");

  const rows = await db
    .select({
      orderId: orders.id,
      reference: orders.reference,
      orderStatus: orders.status,
      paymentStatus: orders.paymentStatus,
      assignedDesignerId: orders.assignedDesignerId,
      designerName: users.name,
      customerName: sql<string>`(
        select name from users where id = ${orders.userId}
      )`,
      orderCreatedAt: orders.createdAt,
      lastActivityAt: orders.lastActivityAt,
      proofStatus: latest.status,
      versionNumber: latest.versionNumber,
      proofCreatedAt: latest.createdAt,
      proofreadAt: latest.proofreadAt,
      customerDecisionAt: latest.customerDecisionAt,
      latestEvent: event.summary,
      latestEventType: event.type,

      /*
        This viewer's own watcher row, joined in rather than fetched per order:
        whether they have seen the latest activity, and whether they have set
        the order aside. Both are per-person, so the join is on their id.
      */
      lastViewedAt: orderWatchers.lastViewedAt,
      snoozedUntil: orderWatchers.snoozedUntil,
    })
    .from(orders)
    .leftJoin(latest, sql`${latest.orderId} = ${orders.id} and ${latest.rank} = 1`)
    .leftJoin(
      event,
      sql`${event.orderId} = ${orders.id} and ${event.rank} = 1`,
    )
    .leftJoin(users, eq(users.id, orders.assignedDesignerId))
    .leftJoin(
      orderWatchers,
      and(
        eq(orderWatchers.orderId, orders.id),
        eq(orderWatchers.userId, viewer.id),
      ),
    )
    .where(
      and(
        sql`${orders.status} not in ('cancelled', 'delivered', 'shipped')`,
        canSeeAllOrders(viewer.role)
          ? undefined
          : eq(orders.assignedDesignerId, viewer.id),
      ),
    )
    .orderBy(desc(orders.createdAt));

  return rows.map((row) => ({
    ...row,
    // When the item entered its current state — what the queue sorts on.
    waitingSince:
      row.customerDecisionAt ??
      row.proofreadAt ??
      row.proofCreatedAt ??
      row.orderCreatedAt,
    /*
      Never opened counts as unseen: everything on it is new to them. Which is
      why an absent watcher row reads as new rather than as seen — the opposite
      default would hide exactly the orders nobody has looked at.
    */
    unseen:
      row.lastViewedAt === null ||
      row.lastActivityAt.getTime() > row.lastViewedAt.getTime(),
  }));
}

export async function loadDesigners() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "designer"))
    .orderBy(users.name);
}
