import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { parseItemKey } from "@/lib/pricing/keys";
import { resolveItems } from "@/lib/pricing/resolve";

const MAX_KEYS = 50;

/**
 * Returns the caller's own negotiated prices for a list of item keys.
 *
 * The user id comes from the session cookie and nowhere else — there is
 * deliberately no user id in the request body, so one customer cannot ask for
 * another customer's rates by guessing an id.
 *
 * Anonymous callers get an empty map rather than an error: the page has
 * already server-rendered the public prices and simply has nothing to swap in.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawKeys = (body as { keys?: unknown })?.keys;
  if (!Array.isArray(rawKeys)) {
    return NextResponse.json({ error: "keys must be an array" }, { status: 400 });
  }

  const session = await getSession("site");

  if (!session) {
    return NextResponse.json({ prices: {} }, { headers: noStore });
  }

  const keys = rawKeys
    .filter((key): key is string => typeof key === "string")
    .filter((key) => parseItemKey(key) !== null)
    .slice(0, MAX_KEYS);

  if (keys.length === 0) {
    return NextResponse.json({ prices: {} }, { headers: noStore });
  }

  const resolved = await resolveItems(keys, session.user.id);

  const prices: Record<
    string,
    { amountMinor: number; currency: string; isCustomerPrice: boolean } | null
  > = {};

  for (const key of keys) {
    const item = resolved.get(key);
    prices[key] = item?.price ?? null;
  }

  return NextResponse.json({ prices }, { headers: noStore });
}

/** Per-customer pricing must never be cached by a CDN or a shared proxy. */
const noStore = { "Cache-Control": "private, no-store" };
