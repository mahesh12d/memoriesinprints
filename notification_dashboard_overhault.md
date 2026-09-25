# Notification & Work-Triage Overhaul — Implementation Spec

## Context

Memories in Prints has three staff-facing roles (Designer, Proofreader, Admin) and a Customer
portal, wired together in one linear approval loop:

```
Customer creates order
   -> Admin/Proofreader intake
   -> Proofreader assigns a Designer
   -> Designer uploads a proof
   -> Proofreader reviews
        -> if changes needed: back to Designer, with comments pinned to specific pages/images
        -> if OK: sent to Customer
   -> Customer reviews
        -> if changes needed: marks up specific pages/images, sends back to Designer + Proofreader
        -> if approved: order moves to Printing
```

Every person in that loop (Designer, Proofreader, Customer) can be holding **10–20 open orders
at once**, each sitting at a different step, with updates arriving continuously and
asynchronously. Today (see reference screenshots) each dashboard shows:

- Six static counter tiles (Waiting on You, Needs Proofreading, With the Customer, Returned to
  Designer, Changes Requested, Approved This Month) — all correct, but **not clickable** and not
  connected to which *specific* order changed.
- A flat "Recent Activity" feed (`tina approved version 3 of MP-1060`, `Sam Carter sent version 3
  of MP-1060 for proofreading`) with no read/unread state and no link from an activity row to the
  order.
- A Work Queue that lists orders grouped by bucket ("Needs Work (6)", "Approved (2)") with a
  "waiting today / waiting 1 day" age string, but **no way to tell an order that just arrived from
  one that has been sitting for hours**, and no visual difference between "this needs *you*
  specifically" and "this is just in the pipeline."
- No notification bell / notification center anywhere in the top nav, for any role.
- No sound, toast, badge-count, or any signal outside of a full page load.
- Order detail pages (`/staff/orders/[id]`) show a step tracker and a History list, but don't mark
  which history entries the current viewer hasn't seen yet, and don't distinguish "new comment
  from customer on page 3" from "printed."

**Root problem:** the system has plenty of *state* (who's waiting on whom) but no *signal of
change* (what's new since I last looked) and no *per-person prioritized queue* (what should I open
first). This is why it "doesn't feel real-time" even when the underlying data is fresh — the user
has to compare timestamps in their head across 10–20 rows to figure out what changed.

## What good SaaS products do differently (research summary)

Patterns pulled from Linear, Asana, GitHub, and general SaaS notification-center practice —
adapt, don't clone:

1. **Global notification bell with unread count**, independent of any one page. Every product
   with multi-person handoffs (Linear, Asana, GitHub, Notion) has this in the header, always
   visible, so a user doesn't have to be on the right page to know something happened.
2. **"Assigned to me" / triage inbox is the home screen**, not a KPI dashboard. Linear's Inbox and
   Asana's "My Tasks" put the *action items* front and center, sorted by priority/age, not buried
   under summary tiles. The six counter tiles here are useful as a *secondary* summary strip, not
   the primary work surface.
3. **New vs. seen, not just read vs. unread.** Linear's Triage and Inbox track a per-user
   `last_viewed_at` on each issue; anything with activity after that gets a highlighted "unseen"
   treatment (bold text, colored dot, left-edge accent bar) until the user opens it — separate from
   any "mark as read" click.
4. **Bundling, not a firehose.** Ten small events on one order ("uploaded page 1", "uploaded page
   2"...) collapse into one line ("designer uploaded 4 pages · 2 min ago") instead of ten rows.
5. **Every notification is actionable in place** — clicking it goes straight to the order at the
   exact step that needs attention, not to a generic activity log.
6. **Aging escalates visually.** "Waiting 1 day" today is plain gray text. Real triage tools
   (Linear, PagerDuty-style escalation, support-ticket SLAs) shift color/weight as something ages
   past a threshold (e.g., green under 4h, amber 4–24h, red 24h+), so a glance at the list tells you
   what's overdue without reading every timestamp.
7. **Snooze, don't force a binary read/unread.** Linear's Triage lets you snooze an item you've
   seen but aren't ready to act on, so it drops out of your "new" pile without pretending it's
   handled.
8. **Role-aware default sort.** A Designer's queue defaults to "sent back with changes" at the top
   (that's blocking); a Proofreader's defaults to "needs proofreading" at the top; a Customer's
   defaults to "proof ready for you" at the top. Same data, different priority order per role.
9. **Live updates without a manual refresh.** Nobody in a modern tool hits refresh to see if a
   proof arrived — the badge/count updates on its own (websocket, SSE, or short-interval
   revalidation) while they're sitting on the page.

## Goals for this project

1. Every role (Designer, Proofreader, Customer, Admin) can tell, at a glance and without opening
   anything, **which of their orders are new/updated since they last looked**.
2. Every role has a single, sorted, actionable **"queue"** that answers "what should I open next,"
   not just a bucketed count.
3. A **global notification bell** exists in every layout (staff + customer), with unread count,
   that works from any page.
4. Updates appear **live** (no manual refresh) while a user is on the dashboard/queue/order page.
5. Aging/urgency is visible **at a glance** via color, not just a text string.
6. None of this requires the customer or staff to understand the underlying workflow engine —
   it should feel like "oh, that one's new" the instant they look at the screen.

## Non-goals / out of scope for this pass

- Email/SMS/push notifications (in-app only for this phase; leave a hook to add later).
- Changing the underlying order-status state machine (Assigned → Artwork → Checked → Customer →
  Approved → Printed) — this is a visualization/notification layer on top of it.
- Redesigning the visual theme (keep existing charcoal/ivory/teal/gold palette, EB Garamond +
  Work Sans).

---

## Data model changes (Drizzle / Postgres)

Add three tables and two columns. Names are suggestions — match existing naming conventions in
the 22-table schema.

### 1. `order_events` (new table)
The append-only source of truth for "something happened on this order." Everything currently
only implied by history strings should become a structured row here.

| column         | type                                  | notes                                                       |
|----------------|---------------------------------------|--------------------------------------------------------------|
| `id`           | uuid, pk                              |                                                                |
| `order_id`     | uuid, fk -> orders.id                 |                                                                |
| `actor_id`     | uuid, fk -> users.id, nullable        | null for system events                                        |
| `event_type`   | text (enum)                           | `proof_uploaded`, `sent_for_proofreading`, `sent_to_customer`, `changes_requested`, `approved`, `assigned_designer`, `payment_received`, `status_changed`, `comment_added`, `printed`, `shipped` |
| `payload`      | jsonb                                 | e.g. `{ version: 5, pageCount: 4 }` or comment text/target page |
| `target_role`  | text (enum), nullable                 | `designer` \| `proofreader` \| `customer` \| `admin` — who this event is "for" (drives whose queue it surfaces in) |
| `created_at`   | timestamptz, default now()            |                                                                |

### 2. `order_watchers` (new table)
Tracks, per user, per order, when they last viewed it — this is what powers "new since you last
looked."

| column          | type                        | notes |
|-----------------|-----------------------------|-------|
| `id`            | uuid, pk                     |       |
| `order_id`      | uuid, fk -> orders.id         |       |
| `user_id`       | uuid, fk -> users.id          |       |
| `last_viewed_at`| timestamptz, nullable         | set on every order-detail page view |
| `snoozed_until` | timestamptz, nullable         | for the snooze feature |
| unique index on (`order_id`, `user_id`)                        |

### 3. `notifications` (new table)
The materialized, per-user, bell-panel feed. Generated from `order_events` at write time (fan-out
on write, not read) so the bell query stays a simple indexed `SELECT`.

| column        | type                        | notes |
|---------------|-----------------------------|-------|
| `id`          | uuid, pk                     |       |
| `user_id`     | uuid, fk -> users.id          | recipient |
| `order_id`    | uuid, fk -> orders.id          |       |
| `event_id`    | uuid, fk -> order_events.id    |       |
| `title`       | text                          | precomputed display string, e.g. "MP-1060 sent back with changes" |
| `read_at`     | timestamptz, nullable         | null = unread |
| `created_at`  | timestamptz, default now()    |       |

### 4. Column additions to existing `orders` table
- `last_activity_at timestamptz` — bump on every `order_events` insert; lets the queue sort by
  recency without a join in the common case.
- `priority_rank smallint` (optional, computed) — cache of the role-aware priority bucket so list
  queries can `ORDER BY priority_rank, last_activity_at` cheaply.

### Migration notes
- Backfill `order_events` from existing history data if history is currently just strings; if
  history is already structured elsewhere, adapt rather than duplicate.
- Write a Drizzle migration (`drizzle-kit generate`) for all of the above; this is migration #21+.

---

## Server actions to add (server-actions-first, per existing architecture)

Group under a new module, e.g. `lib/actions/notifications.ts` and `lib/actions/order-activity.ts`:

- `recordOrderEvent(orderId, eventType, payload, targetRole?)` — inserts into `order_events`,
  bumps `orders.last_activity_at`, and fans out into `notifications` for the relevant user(s)
  based on `target_role` + current assignment (designer/proofreader/customer on that order). Call
  this from every existing action that changes order state (upload proof, send for proofreading,
  request changes, approve, mark printed, etc.) instead of writing a plain history string.
- `markOrderViewed(orderId, userId)` — upserts `order_watchers.last_viewed_at = now()`. Call this
  server action when an order detail page mounts (or on a debounced client effect), and again on
  visibility-regain if the tab was backgrounded.
- `getUnseenOrderIds(userId, orderIds[])` — returns which of a list of orders have
  `last_activity_at > order_watchers.last_viewed_at` (or no watcher row at all) for that user.
  Used by dashboard/queue/orders-list to badge rows.
- `getMyQueue(userId, role)` — the core query behind the new "My Queue" view: pulls open orders
  where `target_role` for the most recent relevant event matches the caller's role, joined with
  unseen status and age, sorted by the role-aware priority rules below.
- `getNotifications(userId, { unreadOnly?, cursor? })` — paginated feed for the bell panel.
- `markNotificationRead(notificationId)` / `markAllNotificationsRead(userId)`.
- `snoozeOrder(orderId, userId, until)` — for the snooze feature on the queue.

Keep these as server actions (not new API routes) to match the existing 59-server-action / 6-API
pattern — the only case that may need a route handler is the live-update transport (see below).

---

## Real-time / "no manual refresh" strategy

Given Neon-hosted Postgres (serverless, connections are pooled/ephemeral) and an RSC-first
Next.js app, avoid raw `LISTEN/NOTIFY` — long-lived DB connections don't fit Neon's serverless
model well. Two viable options, pick one for this phase:

**Option A — Polling via SWR/React Query (recommended to start, least infra risk)**
- Add a lightweight client component wrapping the bell + queue + dashboard tiles that polls a
  small "digest" server action (`getNotificationDigest(userId)` → `{ unreadCount, latestEventAt }`)
  every 10–15 seconds using `setInterval` + `router.refresh()`, or SWR's `refreshInterval`.
  Cheap: single indexed query, not the full notification list.
  Only re-fetch the full list/queue when `latestEventAt` actually advances.
- Pros: no new infra, works with server actions as-is, trivial to reason about.
- Cons: not instant (10–15s latency), constant background traffic.

**Option B — Server-Sent Events (SSE) via one API route**
- Add exactly one API route, e.g. `app/api/notifications/stream/route.ts`, that holds a streaming
  response per logged-in user and pushes an event whenever `recordOrderEvent` fires for them
  (via an in-process pub/sub if single-instance, or a small Redis/Upstash pub/sub channel if
  running on multiple serverless instances — Upstash Redis pairs well with Neon/Vercel).
- Client subscribes with `EventSource`, invalidates the SWR cache / calls `router.refresh()` on
  message.
- Pros: near-instant, still lightweight infra (one Redis add-on).
- Cons: one more moving part (pub/sub), needs care with serverless connection limits.

**Recommendation:** ship Option A first (it's a same-day addition with the existing stack), and
leave a clearly marked seam (`lib/realtime.ts` with a single `subscribeToOrderUpdates` interface)
so Option B can replace the polling transport later without touching UI code.

---

## UI/UX changes, page by page

### 1. Global: new notification bell (all layouts — staff sidebar header and customer header)
- Bell icon in the top-right header row, next to the theme toggle, on every role's layout.
- Unread count badge (small circle, teal or red depending on whether any item is "urgent" per the
  aging rule below) — same visual language as the existing "1 Issue" pill already seen floating in
  the corner of some screenshots (reuse that component if it's generic enough).
- Click opens a dropdown/panel (not a full page) listing recent notifications, newest first,
  grouped by order when there are multiple events on the same order in a short window (see
  "bundling" in research summary) — e.g. "MP-1060 · Sam Carter uploaded 4 pages · 2 min ago"
  instead of 4 separate lines.
- Each row is clickable and routes straight to `/staff/orders/[id]` (or the customer equivalent)
  at the relevant tab/section.
- "Mark all as read" action at the top of the panel.
- Empty state: reuse the existing calm tone from "Nothing Needs You Right Now."

### 2. Dashboard (`/staff` for Designer/Proofreader, customer `/account`)
- Keep the six counter tiles, but make each one **clickable**, filtering the queue below to that
  bucket.
- Replace "Recent Activity" flat list with the same bundled-event format as the bell panel, but
  add a left-edge color bar or dot on rows that are still unseen by this user.
- Add a new "My Queue" section above or beside Recent Activity — this is the actual work list
  (see next section), not just a summary.

### 3. My Queue / Work Queue (`/staff/queue`, and a new customer-facing "My Orders — needs you"
   tab)
- Sort order, role-aware, applied by default (user can re-sort manually):
  - **Designer:** "Sent back with changes" first (blocking, urgent), then "Newly assigned,"
    then everything else by age.
  - **Proofreader:** "Needs proofreading" (new from designer) first, then "Returned by customer
    with markup," then everything else.
  - **Customer:** "Proof ready for your review" first, then "Order form waiting," then everything
    else.
- Each row gets:
  - An **unseen indicator** — a small filled dot or "New" chip to the left of the order reference,
    shown only if `last_activity_at > last_viewed_at` for this viewer. Disappears the moment they
    open the order (via `markOrderViewed`), not on any separate "mark read" click.
  - **Aging color**, replacing today's plain gray "waiting 1 day" text:
    - 0–4h: neutral/gray, "waiting Xh"
    - 4–24h: amber text or amber left border
    - 24h+: red/warm text or red left border, plus move to top of its bucket
  - A one-line "why it's here" reason, e.g. "Customer marked 2 pages for changes" instead of just
    a status pill — pull this from the most recent `order_events` row's payload.
  - A **snooze** affordance (small clock icon) for items the user has seen and isn't ready to act
    on — sets `snoozed_until`, drops it from the default view until that time or until new
    activity supersedes the snooze.

### 4. Order detail (`/staff/orders/[id]`, customer equivalent)
- Call `markOrderViewed` on page load (and again if the tab regains focus after being hidden for
  a while).
- In the History panel, visually distinguish entries that happened after the viewer's *previous*
  `last_viewed_at` (i.e., "what's new since last time you were here") with a subtle highlight or a
  "since your last visit" divider line — this is the single highest-value change for reducing
  confusion when someone reopens an order they've seen before.
- When changes/comments are attached to specific pages/images (per the existing markup flow),
  surface a small "2 comments" badge directly on the relevant proof-page thumbnail, not just in
  the text history — so the designer doesn't have to read the whole history to know which pages
  need rework.

### 5. Orders list (`/staff/orders`, customer `/account/orders`)
- Add the same unseen dot/chip per row as the queue.
- Add a "Sort: Needs attention first" default option, separate from the existing status-tab
  filters, so it's possible to see "everything, but the urgent ones first" instead of only
  filtering by exact status.

---

## Component inventory (new)

Match the existing "own component set, no shadcn" convention (CVA + Radix `Slot` + clsx/
tailwind-merge + framer-motion sparingly):

- `NotificationBell` (client component) — icon + badge + panel trigger.
- `NotificationPanel` (client component) — dropdown list, bundled rows, mark-all-read.
- `NotificationRow` — single bundled notification, reusable inside panel and dashboard feed.
- `UnseenDot` / `NewChip` — tiny shared primitive used on queue rows, order-list rows, and
  proof-page thumbnails.
- `AgingBadge` — takes a timestamp + thresholds, renders the color-coded "waiting Xh" pill,
  replacing the current plain text in Work Queue.
- `MyQueueList` — the role-aware sorted queue, used on both the dashboard and `/staff/queue`.
- `SnoozeButton` — small icon button + a lightweight duration picker (1h / 4h / tomorrow).

All of these should be built as RSC-friendly where possible (server-rendered list, client
component only for the interactive bits — bell trigger, snooze picker, mark-as-read clicks),
consistent with the RSC-first architecture already in place.

---

## Phased rollout

**Phase 1 (highest value, smallest surface area):**
1. `order_events` + `order_watchers` tables, `recordOrderEvent` wired into existing state-change
   actions, `markOrderViewed` on order detail mount.
2. `UnseenDot` on Work Queue and Orders list rows (this alone fixes "can't tell what's new").
3. `AgingBadge` color-coding on Work Queue (replaces plain "waiting Xh" text).

**Phase 2:**
4. Global `NotificationBell` + `NotificationPanel`, `notifications` table, fan-out on write.
5. Bundled/grouped notification rows.
6. Role-aware default sort on the queue.

**Phase 3:**
7. Snooze.
8. Per-thumbnail comment badges on proof pages.
9. Swap polling for SSE (Option B) if 10–15s latency proves too slow in practice.

---

## Acceptance criteria (for Phase 1, minimum bar to consider this "fixed")

- A Designer with 10 open orders can tell, without opening any of them, which ones have new
  activity since they last looked, and which are just sitting unchanged.
- A Proofreader can look at the Work Queue and immediately identify the single oldest/most urgent
  item without reading every "waiting X" string.
- Opening an order clears its own unseen indicator; it does not clear indicators on other orders.
- A Customer, on their dashboard/orders page, can tell which order(s) have a proof ready for them
  versus which are just "with the studio."
- None of the above requires a page refresh to update after another user's action, at least on a
  10–15 second delay (Phase 1 can rely on normal navigation; live-without-refresh lands in the
  real-time section above, can follow in the same pass or immediately after).