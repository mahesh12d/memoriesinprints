import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customerProductPrices, productSizes, products, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import type { PriceRow } from "@/components/admin/price-table";
import {
  deleteCustomerProductPriceAction,
  saveCustomerProductPriceAction,
} from "@/lib/pricing/admin-actions";
import { SizePicker } from "../products/size-picker";

export default async function CustomerProductPricesPage() {
  await requireAdmin();

  const [sizes, customers, existing] = await Promise.all([
    db
      .select({
        sizeId: productSizes.id,
        sizeLabel: productSizes.label,
        productId: products.id,
        productName: products.name,
      })
      .from(productSizes)
      .innerJoin(products, eq(products.id, productSizes.productId))
      .orderBy(asc(products.sortOrder), asc(productSizes.sortOrder)),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.role, ["customer"]))
      .orderBy(asc(users.name)),
    db
      .select({
        id: customerProductPrices.id,
        userId: customerProductPrices.userId,
        productSizeId: customerProductPrices.productSizeId,
        amountMinor: customerProductPrices.amountMinor,
        currency: customerProductPrices.currency,
        note: customerProductPrices.note,
      })
      .from(customerProductPrices),
  ]);

  const bySize = new Map(sizes.map((size) => [size.sizeId, size]));
  const byUser = new Map(customers.map((customer) => [customer.id, customer]));

  const rows: PriceRow[] = existing
    .map((price) => {
      const size = bySize.get(price.productSizeId);
      const customer = byUser.get(price.userId);
      return {
        id: price.id,
        subject: size
          ? `${size.productName} — ${size.sizeLabel}`
          : "Unknown size",
        customer: customer
          ? `${customer.name} (${customer.email})`
          : "Unknown customer",
        amount: formatMoney(price.amountMinor, price.currency),
        note: price.note,
      };
    })
    .sort((a, b) => (a.customer ?? "").localeCompare(b.customer ?? ""));

  return (
    <SizePicker
      sizes={sizes}
      rows={rows}
      saveAction={saveCustomerProductPriceAction}
      deleteAction={deleteCustomerProductPriceAction}
      customerOptions={customers.map((customer) => ({
        value: customer.id,
        label: `${customer.name} (${customer.email})`,
      }))}
    />
  );
}
