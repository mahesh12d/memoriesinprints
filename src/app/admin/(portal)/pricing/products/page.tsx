import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { productPrices, productSizes, products } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import type { PriceRow } from "@/components/admin/price-table";
import {
  deleteProductPriceAction,
  saveProductPriceAction,
} from "@/lib/pricing/admin-actions";
import { SizePicker } from "./size-picker";

export default async function ProductPricesPage() {
  await requireAdmin();

  const sizes = await db
    .select({
      sizeId: productSizes.id,
      sizeLabel: productSizes.label,
      productId: products.id,
      productName: products.name,
    })
    .from(productSizes)
    .innerJoin(products, eq(products.id, productSizes.productId))
    .orderBy(asc(products.sortOrder), asc(productSizes.sortOrder));

  const existing = await db
    .select({
      id: productPrices.id,
      productSizeId: productPrices.productSizeId,
      amountMinor: productPrices.amountMinor,
      currency: productPrices.currency,
    })
    .from(productPrices);

  const bySize = new Map(sizes.map((size) => [size.sizeId, size]));

  const rows: PriceRow[] = existing
    .map((price) => {
      const size = bySize.get(price.productSizeId);
      return {
        id: price.id,
        subject: size
          ? `${size.productName} — ${size.sizeLabel}`
          : "Unknown size",
        amount: formatMoney(price.amountMinor, price.currency),
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return (
    <SizePicker
      sizes={sizes}
      rows={rows}
      saveAction={saveProductPriceAction}
      deleteAction={deleteProductPriceAction}
    />
  );
}
