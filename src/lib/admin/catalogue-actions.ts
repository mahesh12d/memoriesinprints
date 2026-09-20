"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { portfolioItems, productSizes, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { fail, type FormState } from "@/lib/auth/form-state";
import { slugify, uniqueSlug } from "@/lib/admin/labels";
import { buildStorageKey, putObject } from "@/lib/storage/storage";
import { markStored } from "@/lib/storage/image-url";
import { checkUpload } from "@/lib/storage/uploads";

const CATEGORIES = ["funeral", "wedding", "celebration"] as const;

/**
 * Stores an uploaded image and hands back the value to save against the row.
 *
 * What is saved is the object key, not a URL: a signed URL expires, so writing
 * one to the database would give a product photo that worked for ten minutes
 * and then didn't. Pages sign it freshly when they render.
 */
async function storeImage(
  file: File | null,
  prefix: string,
): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;

  const check = checkUpload({
    type: file.type,
    size: file.size,
    name: file.name,
  });

  if (!check.ok) return { error: check.reason };
  if (file.type === "application/pdf") {
    return { error: "Catalogue images need to be a picture, not a PDF." };
  }

  const storageKey = buildStorageKey(prefix, file.name);
  const body = Buffer.from(await file.arrayBuffer());

  await putObject(storageKey, body, file.type);

  return { url: markStored(storageKey) };
}

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

const productSchema = z.object({
  name: z.string().trim().min(2, "Give the product a name."),
  category: z.enum(CATEGORIES),
  summary: z.string().trim().max(400).optional(),
  description: z.string().trim().max(6000).optional(),
  minimumQuantity: z.coerce
    .number()
    .int()
    .min(1, "The minimum order has to be at least one."),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean(),
});

function readProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    summary: formData.get("summary") || undefined,
    description: formData.get("description") || undefined,
    minimumQuantity: formData.get("minimumQuantity") || 1,
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = readProductForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That didn't save.");
  }

  const image = await storeImage(formData.get("image") as File | null, "catalogue");
  if (image && "error" in image) return fail(image.error);

  const existing = await db.select({ slug: products.slug }).from(products);
  const slug = uniqueSlug(
    slugify(parsed.data.name),
    existing.map((row) => row.slug),
  );

  const [created] = await db
    .insert(products)
    .values({
      slug,
      name: parsed.data.name,
      category: parsed.data.category,
      summary: parsed.data.summary ?? null,
      description: parsed.data.description ?? null,
      minimumQuantity: parsed.data.minimumQuantity,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      heroImageUrl: image?.url ?? null,
    })
    .returning({ id: products.id });

  revalidatePath("/admin/products");
  revalidatePath("/products");

  redirect(`/admin/products/${created.id}`);
}

export async function updateProductAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  if (!z.string().uuid().safeParse(productId).success) {
    return fail("That product isn't one we recognise.");
  }

  const parsed = readProductForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That didn't save.");
  }

  const image = await storeImage(formData.get("image") as File | null, "catalogue");
  if (image && "error" in image) return fail(image.error);

  // The slug is kept: changing it would break links the studio has already
  // given out. Renaming the product is fine; its address stays put.
  await db
    .update(products)
    .set({
      name: parsed.data.name,
      category: parsed.data.category,
      summary: parsed.data.summary ?? null,
      description: parsed.data.description ?? null,
      minimumQuantity: parsed.data.minimumQuantity,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
      ...(image ? { heroImageUrl: image.url } : {}),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/products");

  return { ok: true, message: "Product saved." };
}

const sizeSchema = z.object({
  productId: z.string().uuid(),
  label: z.string().trim().min(1, "Give the size a name."),
  widthMm: z.coerce.number().int().positive().optional(),
  heightMm: z.coerce.number().int().positive().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export async function addProductSizeAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = sizeSchema.safeParse({
    productId: formData.get("productId"),
    label: formData.get("label"),
    widthMm: formData.get("widthMm") || undefined,
    heightMm: formData.get("heightMm") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
  });

  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That size didn't save.");
  }

  await db.insert(productSizes).values({
    productId: parsed.data.productId,
    label: parsed.data.label,
    widthMm: parsed.data.widthMm ?? null,
    heightMm: parsed.data.heightMm ?? null,
    sortOrder: parsed.data.sortOrder,
  });

  revalidatePath(`/admin/products/${parsed.data.productId}`);
  revalidatePath("/products");

  return { ok: true, message: "Size added." };
}

/**
 * Retires a size rather than deleting it.
 *
 * Orders and prices point at these rows, so removing one would take the size
 * off an order that has already been placed. Retired sizes stop being offered
 * and stay readable on everything that used them.
 */
export async function retireProductSizeAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const sizeId = String(formData.get("sizeId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const restore = formData.get("restore") === "true";

  if (!z.string().uuid().safeParse(sizeId).success) return;

  await db
    .update(productSizes)
    .set({ isActive: restore })
    .where(eq(productSizes.id, sizeId));

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/products");
}

/* -------------------------------------------------------------------------- */
/* Portfolio                                                                  */
/* -------------------------------------------------------------------------- */

const portfolioSchema = z.object({
  title: z.string().trim().min(2, "Give the piece a title."),
  category: z.enum(CATEGORIES),
  description: z.string().trim().max(4000).optional(),
  sortOrder: z.coerce.number().int().default(0),
  isPublished: z.boolean(),
});

function readPortfolioForm(formData: FormData) {
  return portfolioSchema.safeParse({
    title: formData.get("title"),
    category: formData.get("category"),
    description: formData.get("description") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
    isPublished: formData.get("isPublished") === "on",
  });
}

export async function createPortfolioItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const parsed = readPortfolioForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That didn't save.");
  }

  const image = await storeImage(formData.get("image") as File | null, "portfolio");
  if (image && "error" in image) return fail(image.error);

  const existing = await db
    .select({ slug: portfolioItems.slug })
    .from(portfolioItems);

  const slug = uniqueSlug(
    slugify(parsed.data.title),
    existing.map((row) => row.slug),
  );

  const [created] = await db
    .insert(portfolioItems)
    .values({
      slug,
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder,
      isPublished: parsed.data.isPublished,
      imageUrl: image?.url ?? null,
    })
    .returning({ id: portfolioItems.id });

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");

  redirect(`/admin/portfolio/${created.id}`);
}

export async function updatePortfolioItemAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const itemId = String(formData.get("itemId") ?? "");
  if (!z.string().uuid().safeParse(itemId).success) {
    return fail("That piece isn't one we recognise.");
  }

  const parsed = readPortfolioForm(formData);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "That didn't save.");
  }

  const image = await storeImage(formData.get("image") as File | null, "portfolio");
  if (image && "error" in image) return fail(image.error);

  await db
    .update(portfolioItems)
    .set({
      title: parsed.data.title,
      category: parsed.data.category,
      description: parsed.data.description ?? null,
      sortOrder: parsed.data.sortOrder,
      isPublished: parsed.data.isPublished,
      ...(image ? { imageUrl: image.url } : {}),
      updatedAt: new Date(),
    })
    .where(eq(portfolioItems.id, itemId));

  revalidatePath("/admin/portfolio");
  revalidatePath(`/admin/portfolio/${itemId}`);
  revalidatePath("/portfolio");

  return { ok: true, message: "Piece saved." };
}

/** Keeps the slug free for reuse when a piece is deleted outright. */
export async function deletePortfolioItemAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const itemId = String(formData.get("itemId") ?? "");
  if (!z.string().uuid().safeParse(itemId).success) return;

  await db.delete(portfolioItems).where(eq(portfolioItems.id, itemId));

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");

  redirect("/admin/portfolio");
}

/** Used by the list screens to show and hide something in one click. */
export async function toggleProductActiveAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const productId = String(formData.get("productId") ?? "");
  if (!z.string().uuid().safeParse(productId).success) return;

  await db
    .update(products)
    .set({
      isActive: formData.get("next") === "true",
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));

  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function togglePortfolioPublishedAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const itemId = String(formData.get("itemId") ?? "");
  if (!z.string().uuid().safeParse(itemId).success) return;

  await db
    .update(portfolioItems)
    .set({
      isPublished: formData.get("next") === "true",
      updatedAt: new Date(),
    })
    .where(eq(portfolioItems.id, itemId));

  revalidatePath("/admin/portfolio");
  revalidatePath("/portfolio");
}
