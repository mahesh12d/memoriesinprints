/**
 * Money is stored as an integer number of minor units plus the currency it was
 * agreed in, so nothing depends on a single site-wide currency.
 *
 * How many minor units make a unit varies — 100 pence to the pound, but 1000
 * fils to the dinar and none at all for the yen — so the divisor is taken from
 * Intl rather than hardcoded to 100.
 */

const DEFAULT_LOCALE = "en-GB";

const exponentCache = new Map<string, number>();

export function minorUnitExponent(currency: string): number {
  const key = currency.toUpperCase();
  const cached = exponentCache.get(key);
  if (cached !== undefined) return cached;

  let exponent = 2;
  try {
    exponent =
      new Intl.NumberFormat(DEFAULT_LOCALE, {
        style: "currency",
        currency: key,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // An unknown currency code shouldn't crash a page; assume 2 and move on.
    exponent = 2;
  }

  exponentCache.set(key, exponent);
  return exponent;
}

export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorUnitExponent(currency);
}

export function majorToMinor(amountMajor: number, currency: string): number {
  return Math.round(amountMajor * 10 ** minorUnitExponent(currency));
}

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale: string = DEFAULT_LOCALE,
): string {
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(minorToMajor(amountMinor, code));
  } catch {
    return `${code} ${minorToMajor(amountMinor, code).toFixed(2)}`;
  }
}

/** Shown wherever no price exists, in place of a zero or a placeholder. */
export const QUOTED_INDIVIDUALLY = "Quoted individually";
