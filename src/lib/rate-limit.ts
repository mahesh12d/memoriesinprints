/**
 * Deliberately not marked "server-only": this module holds no secrets and no
 * request state, and the guard would make it unimportable from a plain Node
 * test. The modules that do touch cookies, the database or credentials —
 * session, tokens, guards, mailer — carry the guard instead.
 */

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter, kept in Redis when there is one.
 *
 * The in-memory map below is per-instance and resets on deploy, which on a
 * serverless host means "8 attempts per 15 minutes" quietly becomes 8 per
 * instance — the limit multiplies by however many are warm, and an attacker
 * spreading attempts across them barely notices it. Upstash gives every
 * instance one shared counter, which is what makes the number mean anything.
 *
 * Without UPSTASH_REDIS_REST_URL and _TOKEN it falls back to the map, so
 * local development and the unit tests need no network. It also falls back if
 * Redis is unreachable: degrading to a weaker limiter beats locking everyone
 * out of the site because a cache is down.
 */
const buckets = new Map<string, Bucket>();

/**
 * Keys Redis has already refused, and the moment their window ends.
 *
 * Once Redis has said "blocked for 900 seconds" there is nothing to learn by
 * asking again for those 900 seconds — it will say the same thing every time,
 * at three commands a go. Someone running a bot at one account would otherwise
 * bill us for tens of thousands of identical answers.
 *
 * This only ever short-circuits to *refused*. An "allowed" answer always comes
 * from Redis, so a note that is missing, stale, or absent on a cold instance
 * costs one extra round trip and can never let anyone through. That is what
 * makes it safe to keep per-instance, unlike the counter itself.
 */
const blockedUntil = new Map<string, number>();

/**
 * Both maps are pruned together once this many blocks are being tracked.
 *
 * Entries expire by time, but an attacker rotating addresses leaves one behind
 * per key they burn, and nothing would ever look at those keys again to notice.
 * Sweeping on a size threshold keeps that bounded without paying an O(n) walk
 * on every request.
 */
const PRUNE_ABOVE = 5000;

export type RateLimitResult = {
  ok: boolean;
  retryAfterSeconds: number;
};

function prune(now: number): void {
  for (const [key, until] of blockedUntil) {
    if (until <= now) blockedUntil.delete(key);
  }
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/** Keys are namespaced so they can't collide with anything else in the store. */
function redisKey(key: string): string {
  return `ratelimit:${key}`;
}

function inMemory(
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

/**
 * One round trip: count this attempt, start the window if it isn't already
 * running, and read how long is left.
 *
 * EXPIRE carries NX so the window is only ever set when there isn't one. A
 * plain EXPIRE would push the deadline back on every attempt, and a caller
 * hammering the endpoint would hold it open indefinitely — the limit would
 * never release.
 */
async function inRedis(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const response = await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/pipeline`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey(key)],
        ["EXPIRE", redisKey(key), String(windowSeconds), "NX"],
        ["TTL", redisKey(key)],
      ]),
      // A limiter that hangs is worse than one that misses: every sign-in
      // would wait on it.
      signal: AbortSignal.timeout(2000),
    },
  );

  if (!response.ok) throw new Error(`Upstash returned HTTP ${response.status}`);

  const [incr, , ttl] = (await response.json()) as { result: number }[];
  const count = incr?.result ?? 0;

  // A missing or already-elapsed TTL should not read as "wait forever".
  const remaining = ttl?.result && ttl.result > 0 ? ttl.result : windowSeconds;

  return count > limit
    ? { ok: false, retryAfterSeconds: remaining }
    : { ok: true, retryAfterSeconds: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  if (blockedUntil.size > PRUNE_ABOVE || buckets.size > PRUNE_ABOVE) prune(now);

  const until = blockedUntil.get(key);
  if (until !== undefined) {
    if (until > now) {
      /**
       * Refused without asking. Skipping the INCR changes nothing: the count
       * is already past the limit, and EXPIRE NX means further attempts were
       * never going to move the deadline anyway.
       */
      return { ok: false, retryAfterSeconds: Math.ceil((until - now) / 1000) };
    }
    blockedUntil.delete(key);
  }

  if (!redisConfigured()) return inMemory(key, limit, windowSeconds);

  try {
    const result = await inRedis(key, limit, windowSeconds);

    if (!result.ok) {
      blockedUntil.set(key, now + result.retryAfterSeconds * 1000);
    }

    return result;
  } catch (error) {
    console.error("[rate-limit] Redis unavailable, using local counter", error);
    return inMemory(key, limit, windowSeconds);
  }
}

/** Exposed for tests. */
export function resetAllRateLimits(): void {
  buckets.clear();
  blockedUntil.clear();
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
