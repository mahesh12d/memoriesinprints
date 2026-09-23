import assert from "node:assert/strict";
import test from "node:test";
import { limitFromEnv, rateLimit, resetAllRateLimits } from "./rate-limit";

/**
 * These exercise the in-memory path. The Upstash variables are cleared below
 * so the suite needs no network and no credentials — the Redis path is covered
 * separately, with a stubbed fetch.
 */
const REDIS_VARS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

const savedRedisEnv = REDIS_VARS.map((name) => [name, process.env[name]] as const);

test.beforeEach(() => {
  resetAllRateLimits();
  for (const name of REDIS_VARS) delete process.env[name];
});

test.after(() => {
  for (const [name, value] of savedRedisEnv) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("allows requests up to the limit, then blocks", async () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(
      (await rateLimit("key", 3, 60)).ok,
      true,
      `attempt ${attempt} should be allowed`,
    );
  }

  const blocked = await rateLimit("key", 3, 60);
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.retryAfterSeconds > 0,
    "a blocked caller should be told how long to wait",
  );
});

test("counts each key separately", async () => {
  await rateLimit("someone@example.com", 1, 60);

  assert.equal((await rateLimit("someone@example.com", 1, 60)).ok, false);
  assert.equal(
    (await rateLimit("someone-else@example.com", 1, 60)).ok,
    true,
    "one person hitting the limit must not lock anyone else out",
  );
});

test("lets a caller through again once the window has passed", async () => {
  assert.equal((await rateLimit("expiring", 1, 1)).ok, true);
  assert.equal((await rateLimit("expiring", 1, 1)).ok, false);

  await new Promise((resolve) => setTimeout(resolve, 1100));

  assert.equal(
    (await rateLimit("expiring", 1, 1)).ok,
    true,
    "the window should reset rather than blocking forever",
  );
});

test("reads limits from the environment, falling back when unusable", () => {
  const key = "RATE_LIMIT_TEST_VALUE";
  delete process.env[key];
  assert.equal(limitFromEnv(key, 8), 8);

  process.env[key] = "25";
  assert.equal(limitFromEnv(key, 8), 25);

  // Nonsense or hostile values must not disable the limiter.
  for (const bad of ["nonsense", "0", "-5", ""]) {
    process.env[key] = bad;
    assert.equal(limitFromEnv(key, 8), 8, `"${bad}" should fall back`);
  }

  delete process.env[key];
});

/**
 * The Redis path, with fetch stubbed.
 *
 * Reading the pipeline response is the part that can silently stop working. If
 * the count were misread, every caller would come back allowed and the limiter
 * would be switched off while still looking like it ran — so this asserts both
 * directions, and that an outage degrades instead of locking people out.
 */
function withStubbedFetch<T>(
  stub: typeof globalThis.fetch,
  body: () => Promise<T>,
): Promise<T> {
  process.env.UPSTASH_REDIS_REST_URL = "https://stub.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "stub-token";

  const original = globalThis.fetch;
  globalThis.fetch = stub;

  return body().finally(() => {
    globalThis.fetch = original;
  });
}

/** Shapes a pipeline reply the way Upstash actually returns one. */
function pipelineReply(count: number, ttl: number) {
  return new Response(
    JSON.stringify([{ result: count }, { result: 1 }, { result: ttl }]),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

test("redis: allows while the count is within the limit", async () => {
  await withStubbedFetch(
    async () => pipelineReply(3, 900),
    async () => {
      assert.equal((await rateLimit("k", 3, 900)).ok, true);
    },
  );
});

test("redis: blocks once the count passes the limit, and reports the TTL", async () => {
  await withStubbedFetch(
    async () => pipelineReply(4, 842),
    async () => {
      const result = await rateLimit("k", 3, 900);
      assert.equal(result.ok, false);
      assert.equal(
        result.retryAfterSeconds,
        842,
        "the wait should come from the live TTL, not the full window",
      );
    },
  );
});

test("redis: sends INCR with EXPIRE NX so attempts cannot hold the window open", async () => {
  let sent: unknown;

  await withStubbedFetch(
    async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return pipelineReply(1, 900);
    },
    async () => {
      await rateLimit("login:someone@example.com", 8, 900);
    },
  );

  assert.deepEqual(sent, [
    ["INCR", "ratelimit:login:someone@example.com"],
    ["EXPIRE", "ratelimit:login:someone@example.com", "900", "NX"],
    ["TTL", "ratelimit:login:someone@example.com"],
  ]);
});

test("redis: falls back to the local counter when Upstash is unreachable", async () => {
  await withStubbedFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      // Still limits, rather than failing open or locking everyone out.
      assert.equal((await rateLimit("down", 1, 60)).ok, true);
      assert.equal((await rateLimit("down", 1, 60)).ok, false);
    },
  );
});

/**
 * The local note that lets a refusal skip the round trip.
 *
 * Two things must stay true: it has to actually stop the calls (that is the
 * whole point), and it must never be the reason someone is let through.
 */
test("redis: a refused key is not asked about again until its window ends", async () => {
  let calls = 0;

  await withStubbedFetch(
    async () => {
      calls += 1;
      return pipelineReply(9, 900);
    },
    async () => {
      const first = await rateLimit("noisy", 8, 900);
      assert.equal(first.ok, false);
      assert.equal(calls, 1);

      for (let attempt = 0; attempt < 50; attempt += 1) {
        const again = await rateLimit("noisy", 8, 900);
        assert.equal(again.ok, false, "still refused");
        assert.ok(
          again.retryAfterSeconds > 0,
          "still told how long to wait, without asking Redis",
        );
      }

      assert.equal(calls, 1, "50 further attempts should cost no extra calls");
    },
  );
});

test("redis: asks again once the window has passed, and can allow", async () => {
  let calls = 0;

  await withStubbedFetch(
    async () => {
      calls += 1;
      // Blocked with one second left, then a fresh window.
      return calls === 1 ? pipelineReply(9, 1) : pipelineReply(1, 900);
    },
    async () => {
      assert.equal((await rateLimit("brief", 8, 900)).ok, false);
      assert.equal((await rateLimit("brief", 8, 900)).ok, false, "short-circuited");
      assert.equal(calls, 1);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const after = await rateLimit("brief", 8, 900);
      assert.equal(after.ok, true, "the note must expire, not block forever");
      assert.equal(calls, 2, "and Redis must be consulted again");
    },
  );
});

test("redis: every allowed answer comes from Redis, never from the note", async () => {
  let calls = 0;

  await withStubbedFetch(
    async () => {
      calls += 1;
      return pipelineReply(calls, 900);
    },
    async () => {
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        assert.equal((await rateLimit("fine", 8, 900)).ok, true);
      }

      assert.equal(
        calls,
        5,
        "a cached 'allowed' would let the shared counter drift out of sync",
      );
    },
  );
});
