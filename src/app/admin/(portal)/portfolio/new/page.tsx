import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { createPortfolioItemAction } from "@/lib/admin/catalogue-actions";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { PortfolioForm } from "@/components/admin/catalogue-forms";

export default async function NewPortfolioItemPage() {
  await requireAdmin();

  return (
    <>
      <PortalHeader
        title="Add a Piece"
        actions={
          <Link
            href="/admin/portfolio"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Portfolio
          </Link>
        }
      />

      <PortalBody>
        <div className="max-w-3xl rounded-md border border-line bg-card p-7">
          <p className="mb-6 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">
            Anything published here appears on the public portfolio. If you are
            showing a family&rsquo;s stationery, make sure you have their
            permission and that no personal details are legible.
          </p>

          <PortfolioForm
            action={createPortfolioItemAction}
            submitLabel="Add the piece"
            values={{
              title: "",
              category: "funeral",
              description: null,
              templateNumber: null,
              style: null,
              isPopular: false,
              sortOrder: 0,
              isPublished: false,
            }}
          />
        </div>
      </PortalBody>
    </>
  );
}
