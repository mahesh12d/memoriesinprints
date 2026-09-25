import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { createProductAction } from "@/lib/admin/catalogue-actions";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { ProductForm } from "@/components/admin/catalogue-forms";

export default async function NewProductPage() {
  await requireAdmin();

  return (
    <>
      <PortalHeader
        title="Add a Product"
        actions={
          <Link
            href="/admin/products"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Products
          </Link>
        }
      />

      <PortalBody>
        <div className="max-w-3xl rounded-md border border-line bg-card p-7">
          <p className="mb-6 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
            Sizes and prices come next: save the product first, then add the
            sizes it comes in, then set a price for each one under Pricing.
            Until a size has a price, the website shows &ldquo;quoted
            individually&rdquo; rather than a figure.
          </p>

          <ProductForm
            action={createProductAction}
            submitLabel="Create the product"
            values={{
              name: "",
              category: "funeral",
              summary: null,
              description: null,
              minimumQuantity: 25,
              sortOrder: 0,
              isActive: true,
            }}
          />
        </div>
      </PortalBody>
    </>
  );
}
