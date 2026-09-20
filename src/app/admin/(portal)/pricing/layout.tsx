import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { PortalBody, PortalHeader } from "@/components/portal/portal-shell";
import { PricingTabs } from "./pricing-tabs";

/**
 * Four screens, one per price table, so base prices and the per-customer
 * overrides are edited independently of each other.
 */
export default async function PricingLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin();

  return (
    <>
      <PortalHeader
        title="Pricing"
        actions={
          <Link
            href="/admin"
            className="text-[13px] font-semibold text-accent-text"
          >
            ← Dashboard
          </Link>
        }
      />
      <PortalBody>
        <div className="flex flex-col gap-7">
          <PricingTabs />
          {children}
        </div>
      </PortalBody>
    </>
  );
}
