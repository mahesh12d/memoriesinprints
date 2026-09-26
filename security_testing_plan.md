# Security Testing Plan — Memories in Prints (Studio App)

## Ground rules before anything else

- **Test on a staging copy, not production**, if at all possible — clone the Neon DB branch
  (Neon supports instant branching, which is ideal for this) and run every test in this doc
  against that branch. Several of these checks (rate-limit exhaustion, auth brute-force,
  malformed-file uploads) can degrade or corrupt data if run against live customer orders.
- If you must test against production, avoid anything destructive (mass account creation,
  intentionally corrupting rows, load-testing that could exhaust Neon connection limits) and take
  a DB snapshot first.
- This is your own application, so authorization isn't a legal concern here the way it would be
  against a third party's system — but still keep a written log of what was tested and when, in
  case a test itself triggers something (locked account, fraud-flagged payment, alert emails to
  real customers).
- Payment flows: if Stripe/PayPal/etc. is integrated, use their sandbox/test-mode keys for all of
  this — never run injection or fuzzing tests against a live payment processor.

## Testing methodology (four layers, do all four — no single layer catches everything)

1. **Static / code review** — read the actual server actions, Drizzle queries, and auth checks.
   This is the most important layer for an app like this because the attack surface is 59 server
   actions, not a handful of REST endpoints — a dynamic scanner will barely touch most of them
   since it can't see or call into server-action-only navigation. Claude Code should do this pass
   directly against the repo.
2. **Dynamic testing (DAST)** — actually click through and script requests against the running
   app (staging) as each of the four roles, trying to do things that role shouldn't be able to.
3. **Dependency / supply-chain scanning** — `npm audit`, and ideally Snyk or GitHub Dependabot,
   against all `package.json` dependencies (Next.js, Drizzle, Radix, framer-motion, etc.).
4. **Configuration / infrastructure review** — headers, cookies, environment variable exposure,
   Neon/Vercel (or wherever it's hosted) access controls, file storage bucket permissions.

Tools: OWASP ZAP (free, good baseline DAST scanner) or Burp Suite Community, `npm audit` /
`pnpm audit`, browser devtools + a REST client (Insomnia/Postman/Hoppscotch) for manually calling
server actions and the 6 API routes with tampered parameters, Lighthouse for a quick headers/
HTTPS sanity pass.

---

## Threat model specific to this app

Before testing generically, be clear about what's actually sensitive here:

- **Four roles**: Customer, Designer, Proofreader, Admin — each should see a *strict subset* of
  orders and data. A Customer must never see another customer's order, address, or payment status.
  A Designer/Proofreader should only see orders they're assigned to (or, for Admin, everything).
- **Order UUIDs in the URL** (e.g. `/staff/orders/cb702c9e-0338-49a5-8409-b2f5df033a2`) — using
  UUIDs instead of sequential integers is good practice (much harder to guess/enumerate than
  `/orders/1057`), but **a hard-to-guess ID is not the same as an authorization check**. If the
  server action behind that page trusts the ID alone without checking "does this session's user
  own or get assigned to this order," it's still an IDOR (Insecure Direct Object Reference) —
  just one that requires the ID to leak rather than be guessed (e.g. via a forwarded email link,
  a referer header, browser history on a shared machine, or a proofreader's own accidentally
  broad query).
- **File uploads** — proof pages (JPEG/PNG/WebP up to 25MB each) are user-controlled binary
  uploads, one of the highest-risk surfaces in the app.
- **Server actions as the primary surface** — 59 of them, across 17 modules, per the existing
  architecture notes. Each one is a potential place where a client can send *any* payload it
  wants, not just what the UI form would produce — the server action must re-validate everything,
  because the client-side form/button being hidden for a role is not a security control.
- **Payments** — order payment status (Paid/Unpaid) shown in the UI; verify this can't be spoofed
  client-side and that pricing/totals are computed server-side, not trusted from client input.

---

## Checklist, mapped to OWASP Top 10:2025

### A01 — Broken Access Control (test this first — it's the highest-impact category for a
multi-role app like this)

- [ ] As a **Customer**, try to open another customer's order by guessing/reusing a UUID you
  found in a screenshot, email, or shared link. Confirm the server returns 403/404, not the data.
- [ ] As a **Designer**, try to open an order that is assigned to a *different* designer (not you)
  by directly navigating to its URL. Confirm access is denied server-side, not just hidden from
  the Work Queue UI.
- [ ] As a **Proofreader**, try to call the "assign designer" or "approve" server action on an
  order that hasn't reached the appropriate step yet (e.g. approve an order still in "Artwork").
- [ ] As a **Customer**, try to directly invoke a Designer/Proofreader/Admin-only server action
  (upload proof, mark printed, change order status) by crafting the request manually (via
  devtools' Network tab replay or a REST client) rather than through the UI. This is the single
  most important test in this whole document: **every server action must check the caller's role
  and ownership on the server, every time — never rely on "the button isn't shown for that role."**
- [ ] Check whether a lower-privileged role can escalate by tampering with a hidden field, a
  role claim in a JWT/cookie if one exists, or a request body field (e.g. `role: "admin"`) that
  the server might trust instead of re-deriving role from the authenticated session.
- [ ] Test the notification/queue endpoints (if the notification-overhaul spec has landed) to
  confirm a user can only ever fetch *their own* `notifications`/`order_watchers` rows, not
  another user's, by ID.

### A02 — Security Misconfiguration

- [ ] Confirm production doesn't expose stack traces, Drizzle/Postgres error messages, or file
  paths in any error response — test by intentionally sending malformed input (wrong types,
  missing fields) to a few server actions and API routes and checking the response body.
- [ ] Confirm `NODE_ENV=production` is actually set in the deployed environment (Next.js relaxes
  several protections and includes verbose errors in dev mode).
- [ ] Check response headers for the basics: `Strict-Transport-Security`, `X-Content-Type-Options:
  nosniff`, `X-Frame-Options` or `frame-ancestors` CSP directive (clickjacking), and a reasonable
  `Content-Security-Policy`. Next.js needs these set explicitly (via `next.config.js` headers or
  middleware/`proxy.ts`) — they're not on by default.
- [ ] Confirm no `.env`, `.git`, `drizzle` migration files, or admin/debug routes are reachable by
  direct URL in production.
- [ ] Confirm the Neon connection string and any API keys are only referenced via server-side env
  vars (`process.env.X` in server components/actions), never accidentally bundled into client
  JavaScript — grep the built client bundle for connection strings/secrets as a sanity check.

### A03 — Software Supply Chain Failures

- [ ] Run `npm audit` (or `pnpm audit`) and review every high/critical finding across Next.js,
  React, Drizzle, framer-motion, Radix, and any auth/upload libraries.
- [ ] Confirm dependency versions are pinned (lockfile committed) so a compromised upstream
  package can't silently update into a build.
- [ ] If using any third-party auth, payment, or file-storage SDK, confirm it's on a maintained,
  non-deprecated version.

### A04 — Cryptographic Failures

- [ ] Confirm passwords (if the app stores its own credentials rather than delegating to an OAuth
  provider) are hashed with bcrypt/argon2/scrypt — never plain text or fast general-purpose hashes
  (MD5/SHA-1/SHA-256 alone).
- [ ] Confirm the app is HTTPS-only in production, with HTTP redirecting to HTTPS.
- [ ] Confirm session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax` or `Strict` — check this
  directly in browser devtools under Application → Cookies.
- [ ] If proof files or customer data are stored in a bucket (S3-compatible or similar), confirm
  the bucket isn't publicly listable/readable and that download links are either short-lived
  signed URLs or gated behind an authenticated server action, not permanently public.

### A05 — Injection

- [ ] **SQL injection**: grep the codebase for any raw SQL (`sql\`...\`` template literals in
  Drizzle, or a raw `pg` query) that concatenates user input directly into the query string
  instead of using Drizzle's parameterized query builder or tagged-template parameter binding.
  Drizzle's normal query builder (`.where(eq(...))` etc.) is parameterized and not vulnerable by
  default — the risk is specifically in any hand-written raw SQL escape hatch. If none exists,
  this category is largely mitigated by the ORM; confirm that's actually true by searching for
  `sql\`` usage across the 17 action modules.
  - Manually try classic payloads (`' OR '1'='1`, `'; DROP TABLE orders; --`) in every text input
    (search boxes — "Reference or customer" search seen in the Orders page is a good target,
    order form fields, comment/markup text) and confirm they're treated as literal text, not SQL.
- [ ] **Stored/reflected XSS**: submit `<script>alert(1)</script>` and similar payloads into every
  free-text field (comments on proofs, order notes, customer name fields, search boxes) and
  confirm they render as inert text, not executed script, wherever that value is later displayed
  to *any* user (including a different role viewing the same order).
- [ ] **Command/path injection**: if the file upload pipeline ever shells out (e.g. for image
  processing/thumbnailing) or builds a file path from the uploaded filename, test uploading a
  file named something like `../../etc/passwd` or containing shell metacharacters, and confirm the
  filename is sanitized/regenerated server-side rather than trusted.

### A06 — Insecure Design

- [ ] Confirm the order-status state machine can't be skipped by calling a later-stage server
  action out of order (e.g. can a customer's "approve" action fire on an order that was never
  actually sent to them, by directly calling the action with a crafted order ID and status?).
- [ ] Confirm there's a rate limit or cooldown on account creation, login attempts, and the
  contact/quote-request form — the current architecture note lists 6 API handlers, all should be
  reviewed for whether they need rate limiting (login especially).
- [ ] Review whether business logic trusts client-sent prices/totals anywhere (e.g. an order
  form posting a price alongside item selections) instead of recomputing server-side from the
  authoritative catalog/pricing data.

### A07 — Authentication Failures

- [ ] Test login with obviously wrong credentials repeatedly — confirm there's account lockout,
  exponential backoff, or CAPTCHA after a threshold, not unlimited attempts.
- [ ] Test password reset flow: confirm reset tokens are single-use, expire quickly, and that the
  response doesn't reveal whether an email exists in the system ("if that email exists, we've sent
  a reset link" rather than "no account found").
- [ ] Confirm session tokens are invalidated on logout and on password change (test by logging in
  on two tabs/devices, changing password in one, confirming the other session dies).
- [ ] Confirm there's no way to register as, or self-promote to, Designer/Proofreader/Admin
  through the public signup flow — those roles should only be assignable by an existing Admin.

### A08 — Software or Data Integrity Failures

- [ ] Confirm uploaded proof images are validated server-side by actual file content (magic
  bytes), not just the filename extension or client-reported `Content-Type` — a `.jpg` extension
  on an actual executable/script should be rejected.
- [ ] Confirm the order History/event log (or the new `order_events` table, if the notification
  spec has landed) can't be forged by a client — every event should be written server-side as a
  consequence of a validated action, never accepted as a client-submitted "log entry."
- [ ] If there's any CI/CD auto-deploy from GitHub, confirm branch protection and required
  reviews are on for the main/production branch, so a compromised contributor account can't push
  straight to production.

### A09 — Security Logging and Alerting Failures

- [ ] Confirm failed login attempts, permission-denied events (someone trying to access another
  user's order), and file-upload rejections are actually logged somewhere reviewable — not just
  swallowed.
- [ ] Confirm logs don't themselves capture sensitive data in plaintext (full card numbers,
  passwords, full session tokens).
- [ ] Confirm there's *some* alerting (even a simple one — Sentry, which the site metadata
  suggests may already be integrated based on the sentry headers seen on the public marketing
  site, is a reasonable fit) for repeated auth failures or 403s from the same session/IP.

### A10 — Mishandling of Exceptional Conditions

- [ ] Send malformed/oversized payloads to server actions (empty body, wrong types, a 100MB file
  where 25MB is the stated limit, a negative/zero quantity on an order) and confirm the app
  fails gracefully with a clean error, not a raw stack trace or an unhandled crash.
- [ ] Test what happens when the Neon DB is briefly unreachable (simulate via a bad connection
  string in staging) — confirm the app shows a reasonable error page rather than leaking internals
  or hanging indefinitely.
- [ ] Test uploading zero files, uploading a corrupted image, and uploading the maximum allowed
  file count/size to confirm all edge cases are handled without exposing internals.

---

## URL / API-specific checks (your point #2)

Given the RSC-first architecture (6 API handlers, 59 server actions), split this into two parts:

**The 6 API route handlers** — enumerate them explicitly (likely candidates: file upload
endpoint, webhook receivers for payment/email, the notification SSE stream if built, auth
callback routes) and for each one:
- [ ] Confirm it checks authentication/authorization itself — API routes don't automatically
  inherit any page-level auth checks the way nested layouts do.
- [ ] Confirm webhook endpoints (payment provider, email provider) verify a signature/secret
  rather than trusting the request body blindly — anyone who finds the URL could otherwise POST
  a fake "payment succeeded" event.
- [ ] Try calling each route directly with `curl`/Postman using no auth, wrong-role auth, and
  correct auth, and confirm the responses differ appropriately (401/403 vs 200).

**Server actions** — since these aren't visible as URLs, the practical test is:
- [ ] Open browser devtools Network tab, perform a normal action (e.g. upload a proof) as a
  Designer, capture the exact server-action request, then replay it with the `orderId` swapped
  to an order you're not assigned to, or replay it while logged in as a Customer session. This is
  the direct analogue of "URL access" testing for a server-actions-based app — the "URL" is the
  action's internal endpoint, and Next.js does not enforce authorization on your behalf; every
  action function must check `auth()`/session + row ownership at the top of its own body.
- [ ] Grep the codebase for any server action that reads `orderId` (or similar) from its
  arguments and queries the DB *without* a `WHERE` clause tying it back to the authenticated
  user's role/assignment — that's the pattern to fix wherever found.

---

## Deliverable format

Track findings in a simple table (or reuse the OWASP Top 10:2025 CWE-mapped checklist format if
you want something more exhaustive than this doc):

| # | Category (OWASP) | Test performed | Result | Severity | Fix status |
|---|-------------------|-----------------|--------|----------|------------|
| 1 | A01 Broken Access Control | Opened another customer's order by UUID | Blocked (403) | — | Pass |
| 2 | A05 Injection | XSS payload in proof comment field | Rendered as script | Critical | Open |

Severity scale: Critical (data breach / full account takeover) → High (cross-user data
access) → Medium (info disclosure, no direct access) → Low (best-practice gap, no direct exploit
demonstrated).

## Suggested order of operations

1. Static code review of auth checks in all 59 server actions (highest value, catches the most
   dangerous class of bug — broken access control — before any live testing).
2. `npm audit` + dependency review (quick, cheap).
3. Manual DAST pass through the A01–A10 checklist above, staging environment, one role at a time.
4. File upload fuzzing (A08).
5. Headers/config review (A02).
6. Write up findings, fix Critical/High first, retest.
