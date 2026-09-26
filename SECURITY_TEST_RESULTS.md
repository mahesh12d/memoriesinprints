# Security test results — Memories in Prints

Against `security_testing_plan.md`. Run on 2026-09-26 by Claude Code, on branch `dev`
at the commit below, in a throwaway container.

| | |
| --- | --- |
| Commit | `dbde139` on `dev` ("Create security testing plan for Studio App") |
| Environment | local production build (`npm run build` + `npm run start`), local PostgreSQL 16, seeded with `npm run db:seed` |
| Object storage | R2 **not** configured, so `.uploads/` and `/api/uploads/...` were live — the app's current documented state |
| Payments | no Razorpay credentials; the webhook was exercised with unsigned payloads only |
| Layers covered | static code review, dynamic testing, dependency scan, configuration review |
| New test file | `e2e/security.spec.ts` — 37 tests, **30 pass, 7 fail**; every failure is a finding below |

Nothing was run against the studio's real database. See finding **1**, which is about
exactly that risk and is the first thing to fix.

## How to re-run it

```bash
# A local database, never the studio's. See finding 1 for why this matters.
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/memories_in_prints"
npm run db:seed
npm run build
npx playwright test e2e/security.spec.ts
```

The suite asserts the behaviour the plan asks for, not the behaviour the app currently
has, so **a failure in that file is a finding and a pass is a control that works**. It
makes its own customer, designer and orders in `beforeAll` and removes them afterwards,
so it can run on its own or in the middle of the suite.

One test in it, `The replay harness › a replayed action really does run`, exists to keep
the rest honest: most access-control tests are of the form "replay this and nothing
changes", which would pass just as happily if the replay did nothing at all. If that
test ever fails, treat every other replay result in the file as void rather than as a
pass.

---

## Findings

| # | Category (OWASP) | Test performed | Result | Severity | Fix status |
|---|---|---|---|---|---|
| 1 | Process / A02 | Ran the seed and the e2e suite in an environment where `DATABASE_URL` was already set | Both aimed at a live Neon database; the seed's first statement deletes every row | **High** | Open |
| 2 | A01 Broken access control | Saved an order form carrying another customer's storage key | Key stored verbatim; that file then reachable | **High** | Open |
| 3 | A08 Integrity | Uploaded HTML bytes named `.png` with `Content-Type: image/png` | Accepted and stored as a proof | Medium | Open |
| 4 | A01 / A02 | Signed in via `/login?next=//example.org/phish` | Browser sent to `example.org` after a successful login | Medium | Open |
| 5 | A02 Misconfiguration | Read the response headers on `/` | No `X-Content-Type-Options`, no framing protection, no `Referrer-Policy`, no CSP | Medium | Open |
| 6 | A10 Exceptional conditions | Uploaded a 12MB proof, then a 26MB one | 12MB silently truncated and lost to an unhandled error; 26MB never reaches the app's own 25MB check | Medium | Open |
| 7 | A09 Logging | Looked for a record of failed logins, permission denials and rejected uploads | Nothing is logged | Low | Open |
| 8 | A03 Supply chain | `npm audit` | 4 moderate, all `esbuild` via `drizzle-kit` (dev only) | Low | Open |
| 9 | A07 Authentication | Read the login limiter's key | Keyed on `email + IP`, so spraying many accounts from one address is not throttled | Low | Open |
| 10 | A07 / A02 | Watched the limiter at runtime | Redis unreachable, so it silently degraded to a per-instance counter | Low | Open (known) |

Severity, as the plan defines it: Critical (data breach / account takeover) → High
(cross-user data access) → Medium (info disclosure, no direct access) → Low
(best-practice gap, no exploit demonstrated).

---

### 1. The seed and the e2e suite point at whatever `DATABASE_URL` is set — High

`e2e/global-setup.ts` runs `npm run db:seed` before every Playwright run, and
`src/db/seed.ts` opens by deleting every row in every table. Neither the seed nor the
Playwright config pins a database: `playwright.config.ts` sets `MAIL_TRANSPORT`,
`ALLOW_LOCAL_UPLOADS` and the rate limits in `webServer.env`, but not `DATABASE_URL`.

In the container this review ran in, `DATABASE_URL` was **already present in the
environment**, pointing at a live Neon database (`ep-rapid-rice-…eu-west-2.aws.neon.tech`,
database `neondb`, user `neondb_owner`, password in the URL). `dotenv` does not overwrite
a variable that is already set, so the `.env` written for this review was ignored and the
first `npm run db:migrate` and `npm run db:seed` both aimed at Neon. They failed with
`ETIMEDOUT` because the container's network policy blocked the host, so **no statement
reached that database** — the destructive `delete from "proof_comments"` never ran. From
that point on every command here was given an explicit local `DATABASE_URL`.

That was luck, not design. Anyone running `npm test` on a machine that can reach the
studio's database, with that variable set in their shell or their `.env`, wipes it.

The plan's own ground rules say to test on a staging copy; this is the mechanism that
would break that rule silently.

**Fix**

- Guard the seed. In `src/db/seed.ts`, refuse to run unless the host in `DATABASE_URL`
  is local, or `ALLOW_DESTRUCTIVE_SEED=1` is set deliberately — the same shape as the
  existing `ALLOW_LOCAL_UPLOADS` guard in `src/lib/storage/objects.ts`, which already
  gets this right for files.
- Pin the database for tests: add `DATABASE_URL` to `webServer.env` in
  `playwright.config.ts`, and have `e2e/global-setup.ts` pass the same value explicitly
  to the seed rather than inheriting whatever is ambient.
- Rotate the Neon credential that is sitting in this environment's variables, since it
  travels with every session and is readable by anything that runs there.

### 2. An order form can claim a storage key from another customer's order — High

`src/lib/order-form/schema.ts:128` accepts any attachment `key` the client sends, as a
string of up to 500 characters, and `saveOrderFormAction` in
`src/lib/order-form/actions.ts` stores it as-is. Nothing checks that the key is one this
order's own upload route issued.

The upload route itself gets this right — `src/app/api/order-form/[orderId]/attachment/route.ts:109`
refuses a PUT whose key is not under `order-forms/<this order's reference>/`, with the
comment "or a caller could write anywhere in the bucket by asking nicely". The action
that *persists* the key has no equivalent check, so the guard is on the write path only.

What the key is later used for is the problem. `src/components/portal/order-form-summary.tsx:113`
calls `signedReadUrl(file.key)` on whatever is stored:

- With R2 configured, that mints a presigned GET for that exact key — **any object in
  the bucket**, including another family's photographs and archived artwork — and shows
  it to the designer, proofreader or admin as if it belonged to this order.
- With R2 not configured (the current state), `/api/uploads/<key>` resolves the key by
  asking which order form holds it. After the graft, the attacker's own form holds it,
  so `mayOpenProof` is evaluated against *their* order and passes.

**Reproduced.** `e2e/security.spec.ts › A08 Integrity failures › an order form cannot
claim a file from outside its own order` saves the seeded customer's form with the
archive key of another customer's finished artwork. The key is stored:

```
Expected value: not "archive/mp-9201/…-final-artwork.pdf"
Received array:     ["archive/mp-9201/…-final-artwork.pdf"]
```

The companion test, `a key from another customer's order stays unreadable`, passes today
only because the grafted row and the victim's own row both match the lookup and
PostgreSQL happened to return the victim's; the key used in the reproduction is an
`archived_storage_key`, which no other row references, so the grafted row is the only
match and the read is deterministic once R2 is in play.

**Fix.** In `saveOrderFormAction`, after the order is loaded (it already selects
`reference` at `src/lib/order-form/actions.ts:65`), drop or reject any attachment whose
key does not start with `order-forms/${order.reference}/` — the same test the PUT route
already makes.

### 3. Uploads are checked by what the client claims, not what the bytes are — Medium

`checkUpload` in `src/lib/storage/uploads.ts:27` validates size and then `file.type`,
which is the browser-supplied `Content-Type`. Nothing reads the file's first bytes. The
plan's A08 item asks for exactly this: "validated server-side by actual file content
(magic bytes), not just the filename extension or client-reported `Content-Type`".

**Reproduced.** `A08 Integrity failures › an upload is checked by its content, not its
claimed type` uploads `<html><script>…</script></html>` as `not-really-an-image.png`
with `Content-Type: image/png`, and it is stored as a proof version.

No remote code execution follows from this today: nothing shells out over uploads,
dimensions are not read server-side, and the bytes are served back with the *claimed*
type, so a browser tries and fails to decode an image rather than running anything. The
cost is integrity — the studio can print, archive and bill against a file that is not
the artwork — plus a stored payload waiting for the first bit of code that does trust
the stored `mimeType`.

**Fix.** Sniff the leading bytes in `checkUpload` and require them to match the claimed
type: `FF D8 FF` for JPEG, `89 50 4E 47` for PNG, `RIFF` + `WEBP` for WebP, `%PDF-` for
PDF. `checkUpload` is deliberately free of server imports so it can be reused on the
client, so take the first bytes as an argument rather than reaching for the file inside
it.

### 4. The login form is an open redirect — Medium

`src/lib/auth/actions.ts:186` accepts any `next` that starts with `/`:

```ts
redirect(typeof next === "string" && next.startsWith("/") ? next : homeForRole(user.role));
```

`//example.org/phish` starts with `/` and is a protocol-relative URL, so the browser
reads it as another origin. `src/app/(auth)/login/page.tsx:18` has the same gap when it
decides whether to put the value in the form's hidden field.

Both Google routes already guard against this — `src/app/api/auth/google/route.ts:38` and
`src/app/api/auth/callback/google/route.ts:86` both test
`startsWith("/") && !startsWith("//")`. The password form was missed.

**Reproduced.** `A10 Exceptional conditions › the login form cannot bounce someone off
this site` signs in from `/login?next=%2F%2Fexample.org%2Fphish` with every off-origin
request intercepted, and records two attempts to reach `http://example.org/phish`.

The value is a phishing link that begins with the studio's own domain and lands on
someone else's site *after* a real, successful sign-in.

**Fix.** Use the same test as the Google routes in both places, and reject a backslash
too: browsers treat `/\evil.example` as protocol-relative as well. A small shared helper
(`safeNextPath`) used by all four call sites would stop this drifting apart again.

### 5. No security response headers — Medium

`next.config.ts` sets `experimental.serverActions` and one redirect, and no `headers()`.
`src/proxy.ts` sets none either. Next adds none of these by default, as the plan notes.

Measured on `/`:

| Header | Present |
| --- | --- |
| `X-Content-Type-Options` | no |
| `X-Frame-Options` / CSP `frame-ancestors` | no |
| `Referrer-Policy` | no |
| `Content-Security-Policy` | no |

`Strict-Transport-Security` was not asserted in the suite, because it is usually
terminated at the CDN and the test runs over plain HTTP — but it is not set by the app
either, so confirm it at whatever sits in front of production.

The missing framing directive is the one with a concrete attack behind it: the proof
review tool is a click-to-place-a-pin surface, and the approve button is the point at
which a customer accepts what will be printed. Both are worth clickjacking.

**Fix.** Add a `headers()` block in `next.config.ts` covering `/(.*)`, with
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: DENY` (or `frame-ancestors 'none'`), and `Strict-Transport-Security`
for production. A CSP needs care with Next's inline bootstrap and the `THEME_SCRIPT` in
`src/app/layout.tsx:29`; start in `Content-Security-Policy-Report-Only` and tighten.

### 6. Proofs between 10MB and 25MB are lost to an unhandled error — Medium

The app promises 25MB per page in three places, and `next.config.ts` raises the server
action body limit to 32MB with a comment about precisely this problem. That setting is
not the one that applies. `src/proxy.ts:32` matches `/account/:path*`, `/staff/:path*`
and `/admin/:path*` — every route that takes an upload — and Next caps the body of a
request matched by middleware at 10MB, under a separate `middlewareClientMaxBodySize`
setting. The body is truncated before the action ever runs:

```
Request body exceeded 10MB for /staff/orders/<id>. Only the first 10MB will be
available unless configured. See …/middlewareClientMaxBodySize for more details.
⨯ Error: Unexpected end of form   digest: '1636994929'
```

Two consequences, both reproduced:

- `A10 › a proof inside the stated limit is accepted` uploads a 12MB PNG — comfortably
  within what the app offers, and an ordinary size for a scanned order of service. It is
  never stored, and the designer is shown no error, because the multipart body is cut off
  mid-file and the parse throws.
- `A10 › a file over the stated limit is refused in words` uploads 26MB. The app's own
  "That file is larger than 25MB" message never appears, because `checkUpload` is never
  reached. This is the plan's A10 item — an oversized upload should fail gracefully, and
  instead it fails with an unhandled server error.

There is no error boundary to catch it: the app has no `error.tsx` or `global-error.tsx`
anywhere. Next's production default page does not leak a stack trace, so nothing is
disclosed — but the designer gets a dead button.

**Fix.** Raise `middlewareClientMaxBodySize` in `next.config.ts` to at least the 32MB
`bodySizeLimit` already set, or narrow the proxy matcher so the upload routes are not
matched by it. Then add an `error.tsx` under `src/app/staff/` and `src/app/account/` so a
thrown action says something to the person in front of it. The comment in
`next.config.ts` should be updated too — it currently explains a limit that is not the
binding one.

### 7. Nothing is logged when access is refused — Low

The plan's A09 asks that failed logins, permission-denied events and upload rejections be
"actually logged somewhere reviewable — not just swallowed". They are swallowed.
`loginAction` and `adminLoginAction` return `fail(...)` with no log line; the ownership
refusals in `src/lib/proofs/actions.ts` and the `notFound()` calls on the staff order
pages write nothing; `checkUpload` rejections return a message to the person and no more.
`activity_events` records successful actions only, by design.

`console.error` is used well where it exists — the Razorpay webhook logs amount and
currency mismatches, `src/lib/auth/google.ts` logs a rejected id token — which is the
pattern to extend.

**Fix.** Log a single structured line on each refusal: failed sign-in (email, IP,
outcome), a guard refusal (actor, role, order, action), a rejected upload (actor,
reason, claimed type and size). Then wire the alert the plan suggests — repeated auth
failures or refusals from one session or address. No Sentry DSN is configured in
`.env.example`, so despite the marketing site's headers there is nothing collecting
these today.

### 8. `npm audit` — 4 moderate, development only — Low

```
esbuild  <=0.24.2   moderate
  GHSA-67mh-4wv8-2f99 — a website can send requests to the dev server and read the response
  via @esbuild-kit/core-utils → @esbuild-kit/esm-loader → drizzle-kit
```

`drizzle-kit` is a dev dependency and does not reach the production bundle, so nothing
deployed is affected; the exposure is a developer running the esbuild dev server on an
untrusted network. `npm audit fix --force` wants `drizzle-kit@0.18.1`, a major
downgrade — do not take it. Wait for a `drizzle-kit` release that moves off
`@esbuild-kit/*` (upstream has migrated to `tsx`), and meanwhile record the finding as
accepted.

The lockfile is committed and dependency ranges are caret-pinned, so the plan's
"pinned lockfile" item passes. `@aws-sdk/*`, `next`, `drizzle-orm`, `zod` and
`@node-rs/argon2` are all current and maintained.

### 9. The login limiter is keyed on email *and* address — Low

`src/lib/auth/actions.ts:125` builds the key as `login:${email}:${await clientKey()}`.
That throttles someone guessing one account's password from one address, which is the
common case. It does not throttle one address trying one password against many accounts —
each new email starts a fresh counter — which is how credential stuffing actually runs.
`forgot:` and `signup:` are keyed on the address alone and are fine.

**Fix.** Add a second, looser counter keyed on the address alone across all login
attempts (say 50 per 15 minutes), checked alongside the per-account one.

### 10. The limiter degrades silently when Redis is unreachable — Low (known)

`src/lib/rate-limit.ts` falls back to a per-instance in-memory counter when Upstash is
missing or unreachable, and says so in its own comment. It happened throughout this run:

```
[rate-limit] Redis unavailable, using local counter Error: Upstash returned HTTP 403
```

`UPSTASH_REDIS_REST_URL` and `_TOKEN` were set in the environment but the host was
blocked, so the limiter was the weaker one for every test. The README already lists
replacing the in-memory limiter as a pre-launch item; the point worth adding is that a
*configured* Redis which is merely unreachable looks exactly the same as none at all, and
only a log line distinguishes them. Alert on that line, so "we have Upstash" cannot be
quietly untrue in production.

---

## Controls that hold

These are the 30 passing tests. Each one is an attack the plan asks about that the app
refuses, and each stays in the suite as a regression guard.

**A01 Broken access control** — the highest-impact category for this app, and the one it
handles best. Every one of the 57 server actions calls a guard (`requireUser`,
`requireStaff`, `requireProofreader`, `requireAdmin` or `getSession`) as its first act,
and every one that takes an id re-derives ownership rather than trusting it.

- An anonymous visitor reaches none of `/account`, `/staff` or `/admin`, or their
  sub-pages.
- A customer is turned away from the studio portal and the back office.
- Copying a valid `mip_session` value into the `mip_admin_session` cookie does not reach
  `/admin`: the proxy only checks that a cookie exists, and `getSession("admin")` requires
  the session row's own scope to match.
- A second customer opening another customer's order by its UUID gets 404 from the proof
  page, the order form and the checkout page. Ownership is in the `WHERE` clause
  (`and(eq(orders.id, orderId), eq(orders.userId, session.user.id))`), so a forged id
  matches nothing rather than being checked afterwards.
- A designer cannot open an order assigned to a different designer — 404 on both the
  order page and its order form, via `canSeeAllOrders` and `mayOpenProof`.
- **A customer replaying a captured staff request is refused.** The plan calls this the
  single most important test in the document. `returnProofToDesignerAction` was captured
  from the proofreader's own browser and replayed, byte for byte with the notes field
  rewritten, from a customer session and then a designer session. Neither changed the
  proof, and neither was recorded as the proofreader.
- A designer tampering with the hidden `orderId` on their own upload form cannot put
  artwork on another designer's job.
- `markNotificationsReadAction` clears only the caller's rows; it takes the user id from
  the session and nowhere else. Same for `/api/pricing/customer`, which deliberately has
  no user id in its request body.

**A02 Misconfiguration** — `/.env`, `/.env.example`, `/.git/config`,
`/drizzle/0000_initial_schema.sql`, `/package.json`, `/next.config.ts` and
`/src/db/schema.ts` are all unreachable by URL. Malformed bodies to
`/api/pricing/customer` (unparseable JSON, a string where an array belongs, nested
objects in the array) return clean 4xx/2xx with no stack frame, no `node_modules` path,
no Drizzle or PostgreSQL error text and no connection string. `.env.example` carries
placeholders and localhost defaults only, and `git ls-files` shows it is the one env file
tracked.

**A04 Cryptographic failures** — the session cookie is `httpOnly`, `SameSite=Lax`,
`path=/`, and `Secure` in production; `document.cookie` cannot see it. Only the SHA-256
hash of the 32-byte token is stored, so the cookie value itself does not appear in
`sessions.token_hash` — a leaked backup cannot be replayed. Every stored password is
`$argon2id$`, and no hash contains the plaintext or looks like a bare MD5.

**A05 Injection** — `' OR '1'='1`, `'; drop table orders; --`, a `UNION SELECT` and an
escaped-quote variant all go through the staff order search as literal text; no error,
and the `orders` and `users` tables are untouched afterwards. That matches the static
review: every `sql\`\`` in the codebase interpolates Drizzle column references or bound
values, and the only `sql.raw` is `src/db/catalogue.ts:226`, where the argument is a
hardcoded column name. Stored XSS was tested across roles — a customer writes
`<img src=x onerror=…><script>…</script>` into the order form's deceased-name and notes
fields, and a designer opening that form sees it as text: no dialog, no `img[src=x]` in
the DOM, no global set. An uploaded filename of `../../../../../../tmp/escaped.png` is
regenerated into a random key under `proofs/`, and `localUploadPath` refuses a key that
escapes the upload directory anyway.

**A06 Insecure design** — a proof at `awaiting_proofreading` cannot be approved by the
customer; `decideProofAction` guards on the proof's own status, not on what the form
posts. `totalMinor`, `paymentStatus`, `status` and `amountMinor` smuggled into a
customer-writable action change nothing: totals are re-derived server-side by
`repriceOrders` from the catalogue, and `createOrderFromCart` reads the cart, never a
posted price. A signup carrying `role=admin`, `isDisabled` and `emailVerifiedAt` produces
an ordinary unverified customer — the insert hardcodes `role: "customer"`. The
forgot-password form gives the same answer for a registered and an unregistered address,
and the login form gives byte-identical wording for a wrong password, an unknown account
and an admin account, backed by `fakeVerifyDelay()` so the timing matches too.

**A07 Authentication** — signing out revokes the session row, so the captured cookie
replayed in a fresh browser is dead rather than merely deleted. Changing a password on
one device signs the other out. A reset link that is not a live token is refused with
"expired or already been used". `resetPasswordAction` revokes every session including the
one doing the reset; `changePasswordAction` keeps the current device and drops the rest.

**A08 Integrity** — the activity log cannot be written by a client: extra `type`,
`summary`, `actorId` and `actor_id` fields added to the upload form are ignored, and the
event that lands is the server's own sentence with the real actor.

**A10 Exceptional conditions** — an upload with the `required` attribute stripped off the
file input is refused with "Choose the pages to upload"; one with the order id blanked is
refused with "Missing order"; neither leaks internals. An empty JSON body, 5,000 keys and
a 100KB key to `/api/pricing/customer` are all handled without a 500. An unsigned
`payment.captured` webhook is refused and writes no payment row — `verifyWebhookSignature`
is HMAC-SHA256 with `timingSafeEqual` and a length check first, and the handler
additionally requires the paid amount and currency to match what was owed, so a genuine
1p payment cannot settle a £300 order.

---

## Not covered, and why

- **Account lockout under real limits.** `playwright.config.ts` raises every
  `RATE_LIMIT_*` to 500 for the suite, deliberately, because it signs in far more often
  than a person would. The limiter's own behaviour is covered by
  `src/lib/rate-limit.test.ts` (`npm run test:unit`), and findings 9 and 10 come from
  reading it rather than from exhausting it. Exercising the production limits needs a run
  with the defaults restored.
- **Payment injection and fuzzing against Razorpay.** No credentials are configured, so
  only the unsigned-webhook path was exercised. Per the plan, this needs the provider's
  sandbox keys and must never run against live.
- **R2 bucket permissions.** R2 is not configured, so bucket listing, public readability
  and signed-URL expiry could not be tested. Finding 2 gets materially worse once R2 is
  in place, so test it at the same time as fixing that.
- **HSTS and TLS.** Terminated in front of the app, wherever it is deployed; not visible
  from a local build.
- **The built client bundle grep for secrets.** Not done in this pass. `src/lib/storage/storage.ts`
  and the session, token and guard modules all carry `server-only`, which is the right
  structural defence, but the plan asks for the grep as a sanity check and it is worth
  doing once against a real production build.
- **Branch protection on `main`.** A repository setting, not visible from the code.
- **Neon and Vercel access controls.** Out of reach from here.

---

## Other things found on the way

Not security findings, but they get in the way of testing the security ones.

1. **Almost every existing e2e test that signs in is broken by an ambiguous locator.**
   `src/components/ui/form.tsx:62` gives the password field a show/hide toggle whose
   accessible name is "Show password" / "Hide password". Under Playwright's strict mode
   `getByLabel("Password")` now matches two elements — the input and the button — and
   throws before typing anything:

   ```
   locator.fill: Error: strict mode violation: getByLabel('Password') resolved to 2 elements:
       1) <input id="password" name="password" type="password" …>
       2) <button aria-label="Show password" …>
   ```

   There are 20 such call sites across `e2e/admin.spec.ts`, `e2e/auth.spec.ts`,
   `e2e/proofs.spec.ts`, `e2e/shop.spec.ts` and `e2e/site.spec.ts`, in each file's
   `signIn` helper. Every test that needs a session fails in the first second. The
   security suite addresses the input as `input[name="password"]` for this reason; the
   same one-line change in each helper fixes the rest.

2. **`npm run db:migrate` fails on an empty database.**
   `drizzle/0008_order_reference_sequence.sql` creates `order_reference_seq` with
   `MINVALUE 1001`, then calls `setval(…, GREATEST(1000, coalesce(max(…), 1000)))`. With
   no orders yet that is `setval(…, 1000)`, which PostgreSQL refuses:
   `setval: value 1000 is out of bounds for sequence "order_reference_seq" (1001..)`.
   The documented getting-started path therefore does not work from scratch; the
   migrations here had to be applied with `psql`. Change the floor to 1001, or seed the
   sequence with `is_called => false`.

3. **`AssignDesignerForm` is imported but never rendered.**
   `src/app/staff/orders/[orderId]/page.tsx:29` imports it and nothing uses it, so
   `assignDesignerAction` — one of the actions the plan asks about by name — is
   unreachable from the studio portal. Either render it for proofreaders and admin, or
   delete it and the action with it. (Its guards are correct; it is only unused.) This is
   why the cross-role replay test uses `returnProofToDesignerAction` instead: an action
   with no UI cannot be captured from one.

4. **`e2e/proofs.spec.ts` uploads PDFs, which `uploadProofAction` rejects.** The action
   requires `image/*` for a proof, on top of `checkUpload`'s wider list, so every upload
   in that spec is refused and the assertions that follow are against state that was
   never created. The security suite uses PNGs for this reason.

5. **`e2e/auth.spec.ts:116` expects wording the app deliberately no longer uses.** It
   waits for "Administrators sign in through the admin portal."; `loginAction` now
   returns the same "don't match an account" message for an admin, on purpose, so as not
   to confirm that an address is an administrator's. The test asserts the old, worse
   behaviour.

6. **`e2e/order-form.spec.ts` still tests the enquiry-id order form.** That form now
   hangs off an order and checks ownership — which is what closed the IDOR its own
   comments describe. The spec builds an enquiry and opens `/order-form/<enquiryId>`,
   which cannot work against the current route.

Items 1 and 4 to 6 mean `npm run test:e2e` does not currently pass on `dev`, independently
of anything in this review. A full-suite run from this container measures it —
**46 passed, 78 failed** in 8 minutes:

| Spec | Passed | Failed |
| --- | --- | --- |
| `security.spec.ts` | 30 | 7 |
| `admin.spec.ts` | 1 | 22 |
| `auth.spec.ts` | 1 | 14 |
| `site.spec.ts` | 9 | 13 |
| `proofs.spec.ts` | 0 | 10 |
| `shop.spec.ts` | 5 | 8 |
| `order-form.spec.ts` | 0 | 4 |

**60 of the 71 failures outside the security spec are the single locator in item 1** — one
`strict mode violation: getByLabel('Password') resolved to 2 elements`, repeated once per
test that needs a session. The rest are items 4 to 6. Fixing item 1 alone should recover
most of the suite.

The security spec scored 30 / 7 here, exactly as it does when run on its own, which is the
point of it building and removing its own fixtures: its result does not depend on what
else ran first.

## Suggested order of work

1. **Finding 1** first, and before anyone runs the suite again on a machine that can
   reach production. It is a few lines and it removes a way to lose the studio's data.
2. **Finding 2** — the one cross-customer data path found, and the only High in the code.
   The fix is one prefix check in `saveOrderFormAction`.
3. **Finding 6** — not an attack, but it loses a designer's work silently today.
4. **Findings 3, 4, 5** together: magic bytes, the `next` guard, the headers block. Each
   is small and self-contained.
5. **Findings 7, 9, 10** — logging and limiter hardening, before launch.
6. **Finding 8** — track it; do not take the forced downgrade.
7. The broken `signIn` helpers above, so the rest of the suite can be trusted again.

Re-run `npx playwright test e2e/security.spec.ts` after each. The file is written so that
a clean run is the retest.
