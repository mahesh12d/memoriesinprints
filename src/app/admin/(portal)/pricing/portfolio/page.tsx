import { asc } from "drizzle-orm";
import { db } from "@/db";
import { portfolioItemPrices, portfolioItems } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/pricing/money";
import { PriceTable, type PriceRow } from "@/components/admin/price-table";
import {
  deletePortfolioPriceAction,
  savePortfolioPriceAction,
} from "@/lib/pricing/admin-actions";

export default async function PortfolioPricesPage() {
  await requireAdmin();

  const [items, existing] = await Promise.all([
    db
      .select({ id: portfolioItems.id, title: portfolioItems.title })
      .from(portfolioItems)
      .orderBy(asc(portfolioItems.sortOrder)),
    db
      .select({
        id: portfolioItemPrices.id,
        portfolioItemId: portfolioItemPrices.portfolioItemId,
        amountMinor: portfolioItemPrices.amountMinor,
        currency: portfolioItemPrices.currency,
      })
      .from(portfolioItemPrices),
  ]);

  const byId = new Map(items.map((item) => [item.id, item]));

  const rows: PriceRow[] = existing
    .map((price) => ({
      id: price.id,
      subject: byId.get(price.portfolioItemId)?.title ?? "Unknown piece",
      amount: formatMoney(price.amountMinor, price.currency),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  return (
    <PriceTable
      rows={rows}
      saveAction={savePortfolioPriceAction}
      deleteAction={deletePortfolioPriceAction}
      itemOptions={items.map((item) => ({ value: item.id, label: item.title }))}
      itemLabel="Portfolio piece"
      itemName="portfolioItemId"
      emptyMessage="No list prices yet. Pieces without one show as quoted individually, which is often right for bespoke work."
    />
  );
}
