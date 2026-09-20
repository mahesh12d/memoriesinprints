import assert from "node:assert/strict";
import test from "node:test";
import {
  limitFromEnv,
  rateLimit,
  resetAllRateLimits,
} from "./rate-limit";

test.beforeEach(() => {
  resetAllRateLimits();
});

test("allows requests up to the limit, then blocks", () => {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    assert.equal(
      rateLimit("key", 3, 60).ok,
      true,
      `attempt ${attempt} should be allowed`,
    );
  }

  const blocked = rateLimit("key", 3, 60);
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.retryAfterSeconds > 0,
    "a blocked caller should be told how long to wait",
  );
});

test("counts each key separately", () => {
  rateLimit("someone@example.com", 1, 60);

  assert.equal(rateLimit("someone@example.com", 1, 60).ok, false);
  assert.equal(
    rateLimit("someone-else@example.com", 1, 60).ok,
    true,
    "one person hitting the limit must not lock anyone else out",
  );
});

test("lets a caller through again once the window has passed", async () => {
  assert.equal(rateLimit("expiring", 1, 1).ok, true);
  assert.equal(rateLimit("expiring", 1, 1).ok, false);

  await new Promise((resolve) => setTimeout(resolve, 1100));

  assert.equal(
    rateLimit("expiring", 1, 1).ok,
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
