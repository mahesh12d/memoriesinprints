import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts } from "@/db/schema";
import { getSession } from "@/lib/auth/session";
import { resolveItems, type ResolvedItem } from "@/lib/pricing/resolve";

const COOKIE = "mip_cart";
const COOKIE_DAYS = 30;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * The cart a signed-in person owns, or the one tied to this browser. Passing
 * create: false lets read paths avoid writing a row for every passer-by.
 */
async function currentCartId(create: boolean): Promise<string | null> {
  const session = await getSession("site");
  const cookieStore = await cookies();

  if (session) {
    const existing = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, session.user.id))
      .limit(1);

    if (existing[0]) return existing[0].id;
    if (!create) return null;

    const [created] = await db
      .insert(carts)
      .values({ userId: session.user.id })
      .returning({ id: carts.id });

    return created.id;
  }

  const token = cookieStore.get(COOKIE)?.value;

  if (token) {
    const existing = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.guestTokenHash, hash(token)))
      .limit(1);

    if (existing[0]) return existing[0].id;
  }

  if (!create) return null;

  const fresh = token ?? randomBytes(24).toString("base64url");

  const [created] = await db
    .insert(carts)
    .values({ guestTokenHash: hash(fresh) })
    .returning({ id: carts.id });

  cookieStore.set(COOKIE, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + COOKIE_DAYS * 86_400_000),
  });

  return created.id;
}

export type CartLine = {
  itemKey: string;
  quantity: number;
  item: ResolvedItem | null;
  lineTotalMinor: number | null;
  currency: string | null;
};

export type CartContents = {
  lines: CartLine[];
  /** One total per currency; more than one means the cart can't be paid as is. */
  totals: { currency: string; amountMinor: number }[];
  itemCount: number;
  hasUnpricedItems: boolean;
  isMixedCurrency: boolean;
};

export const EMPTY_CART: CartContents = {
  lines: [],
  totals: [],
  itemCount: 0,
  hasUnpricedItems: false,
  isMixedCurrency: false,
};

export async function getCartContents(): Promise<CartContents> {
  const cartId = await currentCartId(false);
  if (!cartId) return EMPTY_CART;

  const rows = await db
    .select({ itemKey: cartItems.itemKey, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId))
    .orderBy(cartItems.createdAt);

  if (rows.length === 0) return EMPTY_CART;

  const session = await getSession("site");
  const resolved = await resolveItems(
    rows.map((row) => row.itemKey),
    session?.user.id ?? null,
  );

  const totals = new Map<string, number>();
  let hasUnpricedItems = false;

  const lines: CartLine[] = rows.map((row) => {
    const item = resolved.get(row.itemKey) ?? null;
    const price = item?.price ?? null;

    if (!price) hasUnpricedItems = true;

    const lineTotalMinor = price ? price.amountMinor * row.quantity : null;

    if (price && lineTotalMinor !== null) {
      totals.set(
        price.currency,
        (totals.get(price.currency) ?? 0) + lineTotalMinor,
      );
    }

    return {
      itemKey: row.itemKey,
      quantity: row.quantity,
      item,
      lineTotalMinor,
      currency: price?.currency ?? null,
    };
  });

  return {
    lines,
    totals: [...totals].map(([currency, amountMinor]) => ({
      currency,
      amountMinor,
    })),
    itemCount: rows.reduce((sum, row) => sum + row.quantity, 0),
    hasUnpricedItems,
    isMixedCurrency: totals.size > 1,
  };
}

export async function getCartCount(): Promise<number> {
  const cartId = await currentCartId(false);
  if (!cartId) return 0;

  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(cartItems)
    .where(eq(cartItems.cartId, cartId));

  return row?.total ?? 0;
}

export async function addToCart(
  itemKey: string,
  quantity: number,
): Promise<void> {
  const cartId = await currentCartId(true);
  if (!cartId) return;

  const qty = Math.max(1, Math.floor(quantity) || 1);

  await db
    .insert(cartItems)
    .values({ cartId, itemKey, quantity: qty })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.itemKey],
      set: { quantity: sql`${cartItems.quantity} + ${qty}` },
    });

  await touch(cartId);
}

export async function setCartQuantity(
  itemKey: string,
  quantity: number,
): Promise<void> {
  const cartId = await currentCartId(false);
  if (!cartId) return;

  const qty = Math.floor(quantity);

  if (qty <= 0) {
    await removeFromCart(itemKey);
    return;
  }

  await db
    .update(cartItems)
    .set({ quantity: qty })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.itemKey, itemKey)));

  await touch(cartId);
}

export async function removeFromCart(itemKey: string): Promise<void> {
  const cartId = await currentCartId(false);
  if (!cartId) return;

  await db
    .delete(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.itemKey, itemKey)));

  await touch(cartId);
}

export async function clearCart(cartId: string): Promise<void> {
  await db.delete(cartItems).where(eq(cartItems.cartId, cartId));
}

export async function getOwnCartId(): Promise<string | null> {
  return currentCartId(false);
}

async function touch(cartId: string): Promise<void> {
  await db
    .update(carts)
    .set({ updatedAt: new Date() })
    .where(eq(carts.id, cartId));
}

/**
 * Called straight after signing in: anything in the browser's guest cart is
 * folded into the account's, so a cart filled before signing in isn't lost.
 * Quantities add up where the same item is in both.
 */
export async function mergeGuestCart(userId: string): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return;

  const [guestCart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(eq(carts.guestTokenHash, hash(token)))
    .limit(1);

  if (!guestCart) return;

  const guestLines = await db
    .select({ itemKey: cartItems.itemKey, quantity: cartItems.quantity })
    .from(cartItems)
    .where(eq(cartItems.cartId, guestCart.id));

  if (guestLines.length > 0) {
    const [userCart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(eq(carts.userId, userId))
      .limit(1);

    const targetId =
      userCart?.id ??
      (
        await db
          .insert(carts)
          .values({ userId })
          .returning({ id: carts.id })
      )[0].id;

    for (const line of guestLines) {
      await db
        .insert(cartItems)
        .values({
          cartId: targetId,
          itemKey: line.itemKey,
          quantity: line.quantity,
        })
        .onConflictDoUpdate({
          target: [cartItems.cartId, cartItems.itemKey],
          set: { quantity: sql`${cartItems.quantity} + ${line.quantity}` },
        });
    }
  }

  await db.delete(carts).where(inArray(carts.id, [guestCart.id]));
  cookieStore.delete(COOKIE);
}
