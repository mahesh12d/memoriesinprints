# Memories in Prints

The web application for Memories in Prints — a UK print studio producing funeral,
wedding and celebration stationery. It covers the public site, a customer area,
a studio staff portal, and a separate admin back office.

This repository is the fresh build that replaces the current site.

## Status

**Milestone 1 — foundation.** Database schema for users, sessions, products,
portfolio, enquiries, orders, proofs with positioned comments, payments,
notifications and pricing. Sign up with email confirmation, sign in and out,
forgotten-password reset, change password, active session list with revoke and
"sign out everywhere else", profile editing, and three role gates — customer
(`/account`), studio staff (`/staff`) and admin (`/admin`), with admin sign-in
independent of customer sign-in.

**Milestone 2 — public site.** Home, Our Work, Products and product detail,
Process, About and FAQ, all reading from the database, plus a working quote
form: it validates, stores the enquiry with a human reference, emails both the
sender and the studio, attaches to the signed-in account when there is one, and
appears in the customer's Quotes page where they can withdraw it. Terms,
privacy and cookies pages exist but say plainly that the wording is still to
come from the studio.

**Milestone 4 — pricing, cart and checkout.** Four price tables in two layers
(list prices and per-customer negotiated rates, for both catalogue products and
portfolio pieces), each row carrying its own currency. A cart that survives
signing in, checkout, order creation, and both payment providers wired up
behind one interface. Four admin screens, one per price table.

Still to come: live payment credentials, the proof review tool, the studio work
queue, and the remaining admin CRUD screens.

## Stack

| Piece      | Choice                                              |
| ---------- | --------------------------------------------------- |
| Framework  | Next.js 16 (App Router) with React 19 and TypeScript |
| Styling    | Tailwind CSS v4, theme tokens in `src/app/globals.css` |
| Database   | PostgreSQL via Drizzle ORM                           |
| Passwords  | Argon2id (`@node-rs/argon2`)                         |
| Validation | Zod                                                  |
| Email      | Nodemailer, with a file-based transport for development |
| Tests      | Playwright                                           |

Fonts (EB Garamond, Work Sans) are self-hosted through Fontsource rather than
loaded from Google Fonts, so no visitor data leaves the site to a third party.

## Colour

The brand palette — green `#2DBC9A`, blue `#465862`, grey `#F8F8F8`, muted
`#A8AAAB` — lives in the `@theme` block at the top of `src/app/globals.css`.
Components reference tokens, never raw hexes, so the whole site restyles from
that one file.

Two of the supplied pairings fall below the 4.5:1 contrast floor for body text:
the muted grey on the grey footer (2.20:1) and white on the green (2.39:1). The
`VARIANT` block at the top of that file holds the three values that differ
between using the hexes literally and using darker shades of the same hues for
small text. It currently uses the accessible variant. A handful of derived
tokens exist for the same reason — `brand-on-dark` and `on-blue-muted` are the
versions that survive the blue band and sidebar.

## Getting started

You'll need Node 20+ and a PostgreSQL 14+ database.

```bash
npm install
cp .env.example .env        # then edit DATABASE_URL
npm run db:migrate          # create the tables
npm run db:seed             # demo accounts and sample data
npm run dev
```

The app runs at http://localhost:3000.

### Demo accounts

Seeded by `npm run db:seed`, all with the password `printsdemo2026`:

| Role        | Email                     | Sign in at     |
| ----------- | ------------------------- | -------------- |
| Customer    | customer@example.com      | `/login`       |
| Designer    | designer@example.com      | `/login`       |
| Proofreader | proofreader@example.com   | `/login`       |
| Admin       | admin@example.com         | `/admin/login` |

These are development fixtures. Remove them before the database goes anywhere
near production.

### Email in development

With `MAIL_TRANSPORT=log` (the default), every message is written to `.mail/` as
an HTML file you can open in a browser, so confirmation and reset links work
without an email provider. Set `MAIL_TRANSPORT=smtp` and fill in the `SMTP_*`
variables to send for real.

## Scripts

| Command               | Does                                              |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Development server                                |
| `npm run build`       | Production build                                  |
| `npm run typecheck`   | TypeScript, no emit                               |
| `npm run lint`        | ESLint                                            |
| `npm run db:generate` | Generate a migration from schema changes          |
| `npm run db:migrate`  | Apply pending migrations                          |
| `npm run db:seed`     | Load demo data                                    |
| `npm run db:studio`   | Browse the database in Drizzle Studio             |
| `npm run test:unit`   | Node unit tests                                   |
| `npm run test:e2e`    | Playwright end-to-end tests                       |
| `npm test`            | Both                                              |

## How pricing works

Four tables in two layers. `product_prices` and `portfolio_item_prices` hold
list prices; `customer_product_prices` and `customer_item_prices` hold rates
negotiated with one account. A customer price always beats the list price, and
where neither exists the item is shown as quoted individually — never as zero
or a placeholder.

Every price row stores its own currency, and each figure is formatted with the
currency it was stored in. The minor-unit divisor comes from `Intl` rather than
a hardcoded 100, so a currency without decimals formats correctly.

Cart and order lines are identified by one string. A catalogue product is
`slug::size::templateNumber`; a portfolio piece is its bare UUID. The separator
decides which path is taken.

Prices are **not** frozen when an order is created. Each line keeps its key, and
`repriceOrders` re-derives the total whenever orders are displayed, so a
catalogue correction reaches existing orders without anyone re-keying them. The
rules, in `src/lib/pricing/reprice-rules.ts`: a paid order is never repriced,
only orders referencing exactly one item are touched, an item that can't be
priced is left alone rather than zeroed, and an unchanged figure is not written
back. A list of any length costs a fixed number of queries.

The `/api/pricing/customer` endpoint takes the user id from the session cookie
and nowhere else — there is deliberately no user id in the request body.

## How authentication works

Sessions are rows in the database, not JWTs, so a session can be revoked the
moment someone asks — which is what makes "sign out my other devices" honest.

- The cookie holds a 32-byte random token; only its SHA-256 hash is stored, so a
  leaked database backup can't be replayed as a login.
- Customer/staff sessions use the `mip_session` cookie. Admin sessions use
  `mip_admin_session`. The two are never interchangeable: an admin cannot sign in
  through the customer form, and a customer session cannot reach `/admin`.
- `src/proxy.ts` only checks whether a cookie exists — it runs before the
  database is reachable. The real check is `requireUser` / `requireStaff` /
  `requireAdmin` in `src/lib/auth/guards.ts`, called by every protected page.
- Changing a password keeps the current device and drops the rest. Resetting a
  forgotten password drops everything, including the device doing the reset.

## Before launch

- [ ] Replace the in-memory rate limiter in `src/lib/rate-limit.ts` with Redis —
      it is per-instance and resets on deploy. (Limits are tunable per
      environment via `RATE_LIMIT_*`; the defaults are the production values.)
- [ ] Fill in the real studio details in `src/lib/studio.ts` — phone, email,
      city, founder name and the social links are placeholders.
- [ ] Write the terms, privacy and cookie notices.
- [ ] Replace the image placeholders with the studio's photography.
- [ ] Point `MAIL_TRANSPORT` at a real provider and verify the sending domain.
- [ ] Add Razorpay and PayPal credentials. Until then checkout records the
      order and says plainly that payment isn't live; nothing pretends to have
      been paid.
- [ ] Confirm which currency the Razorpay account settles in before taking
      live payments in anything other than that currency.
- [ ] Decide where proof images are stored (S3, R2 or similar).
- [ ] Remove the seeded demo accounts.

## Structure

```
src/
  app/
    (site)/          public marketing site, products, quote form
    (auth)/          sign in, sign up, verify, reset
    account/         customer area
    staff/           studio staff portal
    admin/           admin back office (login sits outside the portal group)
  components/        shared UI, site chrome and portal chrome
  content/           editorial copy, kept out of the layout
  db/                schema, client, seed
  lib/
    auth/            passwords, sessions, tokens, guards, server actions
    cart/            cart contents and guest-cart merging
    enquiries/       quote request handling
    payments/        provider interface, Razorpay, PayPal, checkout
    pricing/         keys, money, resolution, repricing
    mail/            transport and templates
  proxy.ts           cookie-level redirects
drizzle/             generated SQL migrations
e2e/                 Playwright tests
```
