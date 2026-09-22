"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/pricing/products", label: "Product list prices" },
  { href: "/admin/pricing/customer-products", label: "Customer product prices" },
  { href: "/admin/pricing/portfolio", label: "Portfolio list prices" },
  { href: "/admin/pricing/customer-portfolio", label: "Customer portfolio prices" },
];

export function PricingTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-5 py-2.5 text-[13px] font-semibold transition-colors ${
              active
                ? "bg-band text-white"
                : "border border-line bg-card text-ink-soft hover:border-brand"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
