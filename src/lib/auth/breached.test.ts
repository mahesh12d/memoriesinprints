import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { suffixIsListed } from "./breached";

/**
 * The parsing is the fragile part. If it stopped matching, every password
 * would be reported as safe and the check would look like it was working
 * while doing nothing at all — so these assert both directions.
 */

/** A response in the shape the range API returns: SUFFIX:count per line. */
const RESPONSE = [
  "003D68EB55068C33ACE09247EE4C639306B:3",
  "012C192B2357E1ADFB6E80B5F3B1A7B4EE1:1",
  "01330C689E5D64F660D6947A93AD634EF8F:4",
].join("\r\n");

test("finds a suffix that is present", () => {
  assert.equal(suffixIsListed(RESPONSE, "012C192B2357E1ADFB6E80B5F3B1A7B4EE1"), true);
});

test("does not match a suffix that is absent", () => {
  assert.equal(suffixIsListed(RESPONSE, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"), false);
});

test("tolerates the carriage returns the API actually sends", () => {
  // The lines arrive CRLF-separated; a naive split leaves \r on each suffix
  // and nothing would ever match.
  assert.equal(suffixIsListed(RESPONSE, "003D68EB55068C33ACE09247EE4C639306B"), true);
});

test("matches regardless of the case the suffix arrives in", () => {
  const lower = RESPONSE.toLowerCase();
  assert.equal(suffixIsListed(lower, "012C192B2357E1ADFB6E80B5F3B1A7B4EE1"), true);
});

test("an empty response matches nothing", () => {
  assert.equal(suffixIsListed("", "012C192B2357E1ADFB6E80B5F3B1A7B4EE1"), false);
});

test("the hash is split the way the range API expects", () => {
  // "password" is the canonical example: its SHA-1 begins 5BAA6.
  const hash = createHash("sha1").update("password").digest("hex").toUpperCase();

  assert.equal(hash.slice(0, 5), "5BAA6");
  assert.equal(hash.slice(5).length, 35, "the suffix is the remaining 35 chars");
});
