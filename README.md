# Memories in Prints

The web application for Memories in Prints — a UK print studio producing funeral,
wedding and celebration stationery. It covers the public site, a customer area,
a studio staff portal, and a separate admin back office.

This repository is the fresh build that replaces the current site.

## Status

Milestone 1 (foundation) is complete and tested:

- Database schema for users, sessions, products, portfolio, enquiries, orders,
  proofs with positioned comments, payments, notifications and pricing.
- Sign up, email confirmation, sign in, sign out.
- Forgotten password and reset, change password.
- Active session list with revoke, and "sign out everywhere else".
- Three role gates: customer (`/account`), studio staff (`/staff`) and admin
  (`/admin`), with admin sign-in independent of customer sign-in.
- Profile editing.

Still to come: the public marketing site, the order and quote screens, the proof
review tool, payments (Razorpay and PayPal), and the admin CRUD screens.

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
| `npm run test:e2e`    | Playwright end-to-end tests                       |

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
      it is per-instance and resets on deploy.
- [ ] Confirm the four pricing layers; the seeded figures are placeholders.
- [ ] Point `MAIL_TRANSPORT` at a real provider and verify the sending domain.
- [ ] Add Razorpay and PayPal credentials.
- [ ] Decide where proof images are stored (S3, R2 or similar).
- [ ] Remove the seeded demo accounts.

## Structure

```
src/
  app/
    (auth)/          sign in, sign up, verify, reset
    account/         customer area
    staff/           studio staff portal
    admin/           admin back office (login sits outside the portal group)
  components/        shared UI and portal chrome
  db/                schema, client, seed
  lib/
    auth/            passwords, sessions, tokens, guards, server actions
    mail/            transport and templates
  proxy.ts           cookie-level redirects
drizzle/             generated SQL migrations
e2e/                 Playwright tests
```
