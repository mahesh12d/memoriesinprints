/**
 * The repricing rules, kept free of database imports so they can be tested
 * directly — the module that talks to Postgres wraps these.
 */
import type { ResolvedItem } from "./resolve-types";

export type OrderLine = {
  itemKey: string | null;
  quantity: number;
};

export type RepriceableOrder = {
  id: string;
  userId: string;
  paymentStatus: string;
  totalMinor: number | null;
  currency: string;
  items: OrderLine[];
};

export type RepricePlan =
  | { action: "skip"; reason: string }
  | { action: "unchanged" }
  | { action: "update"; totalMinor: number; currency: string };

/**
 * Decides what should happen to one order. Pure, so the rules can be tested
 * without a database behind them.
 *
 * The rules, in order:
 *   1. A paid order is never repriced. What someone paid is what they paid.
 *   2. Only orders referencing exactly one item are repriced; anything with
 *      none, or with several, is left alone.
 *   3. An item we can no longer price is left alone rather than zeroed.
 *   4. A figure that hasn't moved is not written back.
 */
export function planReprice(
  order: RepriceableOrder,
  resolved: Map<string, ResolvedItem>,
): RepricePlan {
  if (order.paymentStatus === "paid") {
    return { action: "skip", reason: "already paid" };
  }

  if (order.items.length !== 1) {
    return {
      action: "skip",
      reason:
        order.items.length === 0 ? "no items" : "more than one item",
    };
  }

  const line = order.items[0];
  if (!line.itemKey) return { action: "skip", reason: "no item key" };

  const item = resolved.get(line.itemKey);
  if (!item) return { action: "skip", reason: "item not found" };
  if (!item.price) return { action: "skip", reason: "quoted individually" };

  const quantity = Math.max(1, line.quantity ?? 1);
  const totalMinor = item.price.amountMinor * quantity;

  if (
    order.totalMinor === totalMinor &&
    order.currency === item.price.currency
  ) {
    return { action: "unchanged" };
  }

  return {
    action: "update",
    totalMinor,
    currency: item.price.currency,
  };
}
