import "server-only";

import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { orderItems, orders } from "@/db/schema";
import { resolveItems } from "./resolve";
import {
  planReprice,
  type OrderLine,
  type RepriceableOrder,
  type RepricePlan,
} from "./reprice-rules";

export { planReprice };
export type { OrderLine, RepriceableOrder, RepricePlan };

export type RepriceOutcome = {
  order: RepriceableOrder;
  plan: RepricePlan;
  /** The order as it should now be shown, whether or not it was written. */
  totalMinor: number | null;
  currency: string;
};

/**
 * Reprices a whole list against the current catalogue.
 *
 * Query budget is fixed regardless of how many orders are passed in: at most
 * five to resolve every distinct item, and one write covering every order
 * whose figure actually moved.
 */
export async function repriceOrders(
  list: RepriceableOrder[],
  userIdForPricing: string | null,
): Promise<RepriceOutcome[]> {
  if (list.length === 0) return [];

  const keys = list
    .flatMap((order) => order.items.map((item) => item.itemKey))
    .filter((key): key is string => Boolean(key));

  const resolved = await resolveItems(keys, userIdForPricing);

  const outcomes: RepriceOutcome[] = list.map((order) => {
    const plan = planReprice(order, resolved);
    return {
      order,
      plan,
      totalMinor:
        plan.action === "update" ? plan.totalMinor : order.totalMinor,
      currency: plan.action === "update" ? plan.currency : order.currency,
    };
  });

  const changed = outcomes.filter(
    (outcome) => outcome.plan.action === "update",
  );

  if (changed.length > 0) {
    // One statement for the lot, rather than a write per order.
    const ids = changed.map((outcome) => outcome.order.id);

    const totalCases = sql.join(
      changed.map(
        (outcome) =>
          sql`when ${orders.id} = ${outcome.order.id}::uuid then ${
            (outcome.plan as { totalMinor: number }).totalMinor
          }`,
      ),
      sql` `,
    );

    const currencyCases = sql.join(
      changed.map(
        (outcome) =>
          sql`when ${orders.id} = ${outcome.order.id}::uuid then ${
            (outcome.plan as { currency: string }).currency
          }`,
      ),
      sql` `,
    );

    await db
      .update(orders)
      .set({
        totalMinor: sql`case ${totalCases} else ${orders.totalMinor} end`,
        currency: sql`case ${currencyCases} else ${orders.currency} end`,
        updatedAt: new Date(),
      })
      .where(inArray(orders.id, ids));
  }

  return outcomes;
}

/** Loads orders with their lines in two queries, ready for repricing. */
export async function loadOrdersWithLines(
  orderIds: string[],
): Promise<Map<string, OrderLine[]>> {
  const map = new Map<string, OrderLine[]>();
  if (orderIds.length === 0) return map;

  const lines = await db
    .select({
      orderId: orderItems.orderId,
      itemKey: orderItems.itemKey,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  for (const line of lines) {
    const existing = map.get(line.orderId) ?? [];
    existing.push({ itemKey: line.itemKey, quantity: line.quantity });
    map.set(line.orderId, existing);
  }

  for (const id of orderIds) {
    if (!map.has(id)) map.set(id, []);
  }

  return map;
}
