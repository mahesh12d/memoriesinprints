import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { customerItemPrices, portfolioItems, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import { PriceTable, type PriceRow } from "@/components/admin/price-table";
import {
  deleteCustomerPortfolioPriceAction,
  saveCustomerPortfolioPriceAction,
} from "@/lib/pricing/admin-actions";

export default async function CustomerPortfolioPricesPage() {
  await requireAdmin();

  const [items, customers, existing] = await Promise.all([
    db
      .select({ id: portfolioItems.id, title: portfolioItems.title })
      .from(portfolioItems)
      .orderBy(asc(portfolioItems.sortOrder)),
    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.role, ["customer"]))
      .orderBy(asc(users.name)),
    db
      .select({
        id: customerItemPrices.id,
        userId: customerItemPrices.userId,
        portfolioItemId: customerItemPrices.portfolioItemId,
        amountMinor: customerItemPrices.amountMinor,
        currency: customerItemPrices.currency,
        note: customerItemPrices.note,
      })
      .from(customerItemPrices),
  ]);

  const byItem = new Map(items.map((item) => [item.id, item]));
  const byUser = new Map(customers.map((customer) => [customer.id, customer]));

  const rows: PriceRow[] = existing
    .map((price) => {
      const customer = byUser.get(price.userId);
      return {
        id: price.id,
        subject: byItem.get(price.portfolioItemId)?.title ?? "Unknown piece",
        customer: customer
          ? `${customer.name} (${customer.email})`
          : "Unknown customer",
        amount: formatMoney(price.amountMinor, price.currency),
        note: price.note,
      };
    })
    .sort((a, b) => (a.customer ?? "").localeCompare(b.customer ?? ""));

  return (
    <PriceTable
      rows={rows}
      saveAction={saveCustomerPortfolioPriceAction}
      deleteAction={deleteCustomerPortfolioPriceAction}
      itemOptions={items.map((item) => ({ value: item.id, label: item.title }))}
      itemLabel="Portfolio piece"
      itemName="portfolioItemId"
      customerOptions={customers.map((customer) => ({
        value: customer.id,
        label: `${customer.name} (${customer.email})`,
      }))}
      emptyMessage="No negotiated portfolio prices yet."
    />
  );
}
