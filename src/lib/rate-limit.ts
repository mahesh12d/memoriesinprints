import "server-only";

type Bucket = { count: number; resetAt: number };

/**
 * In-memory fixed-window limiter. Good enough for one server and for keeping
 * casual brute force off the login form.
 *
 * NOTE: this resets on deploy and is per-instance, so it does not hold across
 * multiple serverless instances. Before launch, swap the Map for Redis
 * (Upstash works well on Vercel) — the call sites below won't need to change.
 */
const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSeconds: 0 };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Keeps the Map from growing without bound on a long-lived server. */
if (typeof setInterval === "function") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  // Don't hold the process open in scripts or tests.
  timer.unref?.();
}
