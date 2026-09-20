import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  customerItemPrices,
  customerProductPrices,
  portfolioItemPrices,
  portfolioItems,
  productPrices,
  productSizes,
  products,
} from "@/db/schema";
import { parseItemKey, type ParsedKey } from "./keys";
import type { ResolvedItem, ResolvedPrice } from "./resolve-types";

export type { ResolvedItem, ResolvedPrice };

/**
 * Resolves a whole list of item keys in a fixed number of queries — five at
 * most, whatever the length of the list — so a long cart or an order page
 * never turns into a query per line.
 *
 * A customer price always beats the base price. Where neither exists the item
 * comes back with price: null, and the caller shows "quoted individually".
 */
export async function resolveItems(
  keys: string[],
  userId: string | null,
): Promise<Map<string, ResolvedItem>> {
  const result = new Map<string, ResolvedItem>();
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return result;

  const parsed: ParsedKey[] = [];
  for (const key of unique) {
    const p = parseItemKey(key);
    if (p) parsed.push(p);
  }

  const productKeys = parsed.filter((p) => p.kind === "product");
  const portfolioKeys = parsed.filter((p) => p.kind === "portfolio");

  /* ---------------------------------------------------------------- */
  /* Catalogue products                                                */
  /* ---------------------------------------------------------------- */

  if (productKeys.length > 0) {
    const slugs = [...new Set(productKeys.map((p) => p.slug))];
    const labels = [...new Set(productKeys.map((p) => p.size))];

    // Query 1: every (product, size) row that could match any key.
    const rows = await db
      .select({
        productId: products.id,
        slug: products.slug,
        name: products.name,
        sizeId: productSizes.id,
        sizeLabel: productSizes.label,
      })
      .from(products)
      .innerJoin(productSizes, eq(productSizes.productId, products.id))
      .where(
        and(
          inArray(products.slug, slugs),
          inArray(productSizes.label, labels),
          eq(products.isActive, true),
          eq(productSizes.isActive, true),
        ),
      );

    const bySlugAndLabel = new Map(
      rows.map((row) => [`${row.slug}\u0000${row.sizeLabel}`, row]),
    );

    const productIds = [...new Set(rows.map((row) => row.productId))];

    // Query 2: the list prices for those products.
    const basePrices = productIds.length
      ? await db
          .select({
            productId: productPrices.productId,
            productSizeId: productPrices.productSizeId,
            amountMinor: productPrices.amountMinor,
            currency: productPrices.currency,
          })
          .from(productPrices)
          .where(
            and(
              inArray(productPrices.productId, productIds),
              eq(productPrices.isActive, true),
            ),
          )
      : [];

    // Query 3: this customer's negotiated rates, if they're signed in.
    const customerPrices =
      userId && productIds.length
        ? await db
            .select({
              productId: customerProductPrices.productId,
              productSizeId: customerProductPrices.productSizeId,
              amountMinor: customerProductPrices.amountMinor,
              currency: customerProductPrices.currency,
            })
            .from(customerProductPrices)
            .where(
              and(
                eq(customerProductPrices.userId, userId),
                inArray(customerProductPrices.productId, productIds),
                eq(customerProductPrices.isActive, true),
              ),
            )
        : [];

    const baseByPair = new Map(
      basePrices.map((row) => [
        `${row.productId}\u0000${row.productSizeId}`,
        row,
      ]),
    );
    const customerByPair = new Map(
      customerPrices.map((row) => [
        `${row.productId}\u0000${row.productSizeId}`,
        row,
      ]),
    );

    for (const key of productKeys) {
      const match = bySlugAndLabel.get(`${key.slug}\u0000${key.size}`);
      if (!match) continue;

      const pair = `${match.productId}\u0000${match.sizeId}`;
      const customer = customerByPair.get(pair);
      const base = baseByPair.get(pair);
      const chosen = customer ?? base;

      result.set(key.raw, {
        key: key.raw,
        kind: "product",
        name: match.name,
        slug: match.slug,
        productId: match.productId,
        productSizeId: match.sizeId,
        sizeLabel: match.sizeLabel,
        templateNumber: key.templateNumber,
        price: chosen
          ? {
              amountMinor: chosen.amountMinor,
              currency: chosen.currency,
              isCustomerPrice: Boolean(customer),
            }
          : null,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Portfolio pieces                                                  */
  /* ---------------------------------------------------------------- */

  if (portfolioKeys.length > 0) {
    const ids = [...new Set(portfolioKeys.map((p) => p.portfolioItemId))];

    // Query 4: the pieces themselves with their list prices.
    const rows = await db
      .select({
        id: portfolioItems.id,
        title: portfolioItems.title,
        slug: portfolioItems.slug,
        amountMinor: portfolioItemPrices.amountMinor,
        currency: portfolioItemPrices.currency,
        priceActive: portfolioItemPrices.isActive,
      })
      .from(portfolioItems)
      .leftJoin(
        portfolioItemPrices,
        eq(portfolioItemPrices.portfolioItemId, portfolioItems.id),
      )
      .where(inArray(portfolioItems.id, ids));

    // Query 5: this customer's negotiated rates on those pieces.
    const customerRows = userId
      ? await db
          .select({
            portfolioItemId: customerItemPrices.portfolioItemId,
            amountMinor: customerItemPrices.amountMinor,
            currency: customerItemPrices.currency,
          })
          .from(customerItemPrices)
          .where(
            and(
              eq(customerItemPrices.userId, userId),
              inArray(customerItemPrices.portfolioItemId, ids),
              eq(customerItemPrices.isActive, true),
            ),
          )
      : [];

    const customerById = new Map(
      customerRows.map((row) => [row.portfolioItemId, row]),
    );

    for (const row of rows) {
      const customer = customerById.get(row.id);
      const hasBase = row.amountMinor !== null && row.priceActive === true;

      const price: ResolvedPrice | null = customer
        ? {
            amountMinor: customer.amountMinor,
            currency: customer.currency,
            isCustomerPrice: true,
          }
        : hasBase
          ? {
              amountMinor: row.amountMinor as number,
              currency: row.currency as string,
              isCustomerPrice: false,
            }
          : null;

      // The key as the caller wrote it, so lookups round-trip.
      const original =
        portfolioKeys.find((k) => k.portfolioItemId === row.id)?.raw ?? row.id;

      result.set(original, {
        key: original,
        kind: "portfolio",
        name: row.title,
        slug: row.slug,
        portfolioItemId: row.id,
        price,
      });
    }
  }

  return result;
}

/** Convenience for a single key. Prefer resolveItems for lists. */
export async function resolveItem(
  key: string,
  userId: string | null,
): Promise<ResolvedItem | null> {
  const map = await resolveItems([key], userId);
  return map.get(key) ?? null;
}
