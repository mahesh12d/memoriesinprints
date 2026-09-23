import { headers } from "next/headers";

/**
 * Who is making this request, for rate limiting and audit trails.
 *
 * Every one of these headers can be written by whoever sends the request, so
 * the order below is a trust order, not a preference. Reading the wrong one
 * lets an attacker mint a fresh identity per attempt by changing a header,
 * which quietly turns the login limiter off.
 *
 *   CF-Connecting-IP   Cloudflare overwrites this on every proxied request,
 *                      so it cannot be forged — but only once traffic
 *                      actually goes through Cloudflare. Trusted only when
 *                      TRUST_CLOUDFLARE_HEADERS says the site is behind it,
 *                      because anyone can send the header directly otherwise.
 *
 *   x-real-ip          Set by the platform proxy (Vercel) and not passed
 *                      through from the client.
 *
 *   x-forwarded-for    A chain the client can prepend to. The leftmost entry
 *                      is the least trustworthy part of it, which is exactly
 *                      what this used to read, so it is the last resort.
 */
export async function clientIp(): Promise<string> {
  const headerList = await headers();

  if (process.env.TRUST_CLOUDFLARE_HEADERS === "1") {
    const cloudflare = headerList.get("cf-connecting-ip")?.trim();
    if (cloudflare) return cloudflare;
  }

  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  // Everything sharing one bucket is the safe failure: it rate-limits too
  // much rather than too little.
  return "unknown";
}
