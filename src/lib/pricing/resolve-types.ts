/**
 * The shapes the resolver returns, kept separate from the resolver itself so
 * pure modules can use them without pulling in a database connection.
 */

export type ResolvedPrice = {
  amountMinor: number;
  currency: string;
  /** True when a negotiated rate replaced the list price. */
  isCustomerPrice: boolean;
};

export type ResolvedItem = {
  key: string;
  kind: "product" | "portfolio";
  name: string;
  /** Null means quoted individually — never treat it as zero. */
  price: ResolvedPrice | null;
  productId?: string;
  productSizeId?: string;
  sizeLabel?: string;
  templateNumber?: number;
  portfolioItemId?: string;
  slug?: string;
};
