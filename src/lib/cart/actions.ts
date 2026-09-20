"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseItemKey } from "@/lib/pricing/keys";
import {
  addToCart,
  removeFromCart,
  setCartQuantity,
} from "./cart";

/** Rejects anything that isn't a well-formed key before it reaches the cart. */
function readKey(formData: FormData): string | null {
  const raw = formData.get("itemKey");
  if (typeof raw !== "string") return null;
  return parseItemKey(raw) ? raw : null;
}

export async function addToCartAction(formData: FormData): Promise<void> {
  const itemKey = readKey(formData);
  if (!itemKey) return;

  const quantity = Number.parseInt(String(formData.get("quantity") ?? "1"), 10);
  await addToCart(itemKey, Number.isFinite(quantity) ? quantity : 1);

  revalidatePath("/cart");

  if (formData.get("then") === "cart") redirect("/cart");
}

export async function setQuantityAction(formData: FormData): Promise<void> {
  const itemKey = readKey(formData);
  if (!itemKey) return;

  const quantity = Number.parseInt(String(formData.get("quantity") ?? "1"), 10);
  await setCartQuantity(itemKey, Number.isFinite(quantity) ? quantity : 1);

  revalidatePath("/cart");
}

export async function removeFromCartAction(formData: FormData): Promise<void> {
  const itemKey = readKey(formData);
  if (!itemKey) return;

  await removeFromCart(itemKey);
  revalidatePath("/cart");
}
