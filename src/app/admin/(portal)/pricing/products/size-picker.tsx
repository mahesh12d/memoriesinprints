"use client";

import { PriceTable, type PriceRow } from "@/components/admin/price-table";
import type { FormState } from "@/lib/auth/form-state";

export type SizeRow = {
  sizeId: string;
  sizeLabel: string;
  productId: string;
  productName: string;
};

/**
 * Prices are per (product, size), so the picker sends both ids. Choosing a
 * size implies its product, which keeps the form to a single control.
 */
export function SizePicker({
  sizes,
  rows,
  saveAction,
  deleteAction,
  customerOptions,
}: {
  sizes: SizeRow[];
  rows: PriceRow[];
  saveAction: (prev: FormState, formData: FormData) => Promise<FormState>;
  deleteAction: (formData: FormData) => Promise<void>;
  customerOptions?: { value: string; label: string }[];
}) {
  const options = sizes.map((size) => ({
    value: `${size.productId}|${size.sizeId}`,
    label: `${size.productName} — ${size.sizeLabel}`,
  }));

  async function save(prev: FormState, formData: FormData) {
    const pair = String(formData.get("productSizePair") ?? "");
    const [productId, productSizeId] = pair.split("|");
    formData.set("productId", productId ?? "");
    formData.set("productSizeId", productSizeId ?? "");
    return saveAction(prev, formData);
  }

  return (
    <PriceTable
      rows={rows}
      saveAction={save}
      deleteAction={deleteAction}
      itemOptions={options}
      itemLabel="Product and size"
      itemName="productSizePair"
      customerOptions={customerOptions}
      emptyMessage="No list prices yet. Anything without one shows as quoted individually."
    />
  );
}
