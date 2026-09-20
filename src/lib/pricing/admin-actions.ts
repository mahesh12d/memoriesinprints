"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  customerItemPrices,
  customerProductPrices,
  portfolioItemPrices,
  productPrices,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { majorToMinor } from "./money";
import { fail, type FormState } from "@/lib/auth/form-state";

/**
 * The four price tables are edited independently, so base prices and the
 * negotiated overrides never get tangled up in one form.
 */

function readAmount(formData: FormData): { amountMinor: number; currency: string } | null {
  const currency = String(formData.get("currency") ?? "GBP")
    .trim()
    .toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) return null;

  const raw = String(formData.get("amount") ?? "").trim();
  if (!raw) return null;

  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return { amountMinor: majorToMinor(amount, currency), currency };
}

const PATHS = [
  "/admin/pricing/products",
  "/admin/pricing/customer-products",
  "/admin/pricing/portfolio",
  "/admin/pricing/customer-portfolio",
];

function revalidateAll() {
  for (const path of PATHS) revalidatePath(path);
}

/* -------------------------------------------------------------------------- */
/* Base product prices                                                        */
/* -------------------------------------------------------------------------- */

export async function saveProductPriceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  const productSizeId = String(formData.get("productSizeId") ?? "");
  const money = readAmount(formData);

  if (!productId || !productSizeId) return fail("Choose a product and size.");
  if (!money) return fail("Enter a valid amount and a three-letter currency.");

  await db
    .insert(productPrices)
    .values({ productId, productSizeId, ...money })
    .onConflictDoUpdate({
      target: [productPrices.productId, productPrices.productSizeId],
      set: { ...money, isActive: true, updatedAt: new Date() },
    });

  revalidateAll();
  return { ok: true, message: "List price saved." };
}

export async function deleteProductPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id) await db.delete(productPrices).where(eq(productPrices.id, id));
  revalidateAll();
}

/* -------------------------------------------------------------------------- */
/* Negotiated product prices                                                  */
/* -------------------------------------------------------------------------- */

export async function saveCustomerProductPriceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const productSizeId = String(formData.get("productSizeId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const money = readAmount(formData);

  if (!userId) return fail("Choose a customer.");
  if (!productId || !productSizeId) return fail("Choose a product and size.");
  if (!money) return fail("Enter a valid amount and a three-letter currency.");

  await db
    .insert(customerProductPrices)
    .values({ userId, productId, productSizeId, note, ...money })
    .onConflictDoUpdate({
      target: [
        customerProductPrices.userId,
        customerProductPrices.productId,
        customerProductPrices.productSizeId,
      ],
      set: { ...money, note, isActive: true, updatedAt: new Date() },
    });

  revalidateAll();
  return { ok: true, message: "Negotiated price saved." };
}

export async function deleteCustomerProductPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id)
    await db
      .delete(customerProductPrices)
      .where(eq(customerProductPrices.id, id));
  revalidateAll();
}

/* -------------------------------------------------------------------------- */
/* Base portfolio prices                                                      */
/* -------------------------------------------------------------------------- */

export async function savePortfolioPriceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const portfolioItemId = String(formData.get("portfolioItemId") ?? "");
  const money = readAmount(formData);

  if (!portfolioItemId) return fail("Choose a portfolio piece.");
  if (!money) return fail("Enter a valid amount and a three-letter currency.");

  await db
    .insert(portfolioItemPrices)
    .values({ portfolioItemId, ...money })
    .onConflictDoUpdate({
      target: [portfolioItemPrices.portfolioItemId],
      set: { ...money, isActive: true, updatedAt: new Date() },
    });

  revalidateAll();
  return { ok: true, message: "List price saved." };
}

export async function deletePortfolioPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id)
    await db.delete(portfolioItemPrices).where(eq(portfolioItemPrices.id, id));
  revalidateAll();
}

/* -------------------------------------------------------------------------- */
/* Negotiated portfolio prices                                                */
/* -------------------------------------------------------------------------- */

export async function saveCustomerPortfolioPriceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const portfolioItemId = String(formData.get("portfolioItemId") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const money = readAmount(formData);

  if (!userId) return fail("Choose a customer.");
  if (!portfolioItemId) return fail("Choose a portfolio piece.");
  if (!money) return fail("Enter a valid amount and a three-letter currency.");

  await db
    .insert(customerItemPrices)
    .values({ userId, portfolioItemId, note, ...money })
    .onConflictDoUpdate({
      target: [customerItemPrices.userId, customerItemPrices.portfolioItemId],
      set: { ...money, note, isActive: true, updatedAt: new Date() },
    });

  revalidateAll();
  return { ok: true, message: "Negotiated price saved." };
}

export async function deleteCustomerPortfolioPriceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (id)
    await db.delete(customerItemPrices).where(eq(customerItemPrices.id, id));
  revalidateAll();
}
