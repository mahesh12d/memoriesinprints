/**
 * Deliberately not marked "server-only": this module holds no secrets and no
 * request state, and the guard would make it unimportable from a plain Node
 * test. The modules that do touch cookies, the database or credentials —
 * session, tokens, guards, mailer — carry the guard instead.
 */

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

/** Exposed for tests. */
export function resetAllRateLimits(): void {
  buckets.clear();
}

/**
 * Limits are read from the environment so they can be tuned without a deploy —
 * and so the end-to-end suite, which signs in far more often than any real
 * person, isn't fighting the lockout. Defaults are the production values.
 */
export function limitFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const LIMITS = {
  login: () => limitFromEnv("RATE_LIMIT_LOGIN", 8),
  adminLogin: () => limitFromEnv("RATE_LIMIT_ADMIN_LOGIN", 5),
  signup: () => limitFromEnv("RATE_LIMIT_SIGNUP", 5),
  forgotPassword: () => limitFromEnv("RATE_LIMIT_FORGOT", 5),
  enquiry: () => limitFromEnv("RATE_LIMIT_ENQUIRY", 5),
} as const;

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
