import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, proofVersions, users } from "@/db/schema";
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
      proofStatus: latest.status,
      versionNumber: latest.versionNumber,
      proofCreatedAt: latest.createdAt,
      proofreadAt: latest.proofreadAt,
      customerDecisionAt: latest.customerDecisionAt,
    })
    .from(orders)
    .leftJoin(latest, sql`${latest.orderId} = ${orders.id} and ${latest.rank} = 1`)
    .leftJoin(users, eq(users.id, orders.assignedDesignerId))
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
  }));
}

export async function loadDesigners() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.role, "designer"))
    .orderBy(users.name);
}
