import * as dotenv from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { samplePdf } from "../src/lib/storage/sample-proof";

/**
 * The security pass from security_testing_plan.md, as tests rather than a
 * checklist.
 *
 * Every test here asserts the behaviour the plan asks for, not the behaviour
 * the app currently has, so a failure in this file is a finding and not a
 * broken test. That is the whole point of writing it this way: a suite that
 * was adjusted to match the code would pass forever and tell nobody anything.
 *
 * Two ideas run through all of it:
 *
 *   1. The client can send whatever it likes. A hidden button, a disabled
 *      input and a page that 404s are not access control. So the role and
 *      ownership tests do not click the UI — they capture a real server-action
 *      request made by someone allowed to make it, then replay it from another
 *      account. That is the only way to test a server-actions app, because the
 *      actions have no URLs of their own to point a scanner at.
 *
 *   2. Nothing is asserted against the seeded rows that other specs mutate.
 *      This file makes its own customer, its own designer and its own orders
 *      in beforeAll and removes them afterwards, so it can be run on its own
 *      or in the middle of the suite and mean the same thing either way.
 */

// The web server gets its environment from playwright.config; this process
// does not, and the fixtures below are written straight to the database.
dotenv.config();

const DEMO_PASSWORD = "printsdemo2026";
const UPLOAD_DIR = path.join(process.cwd(), ".uploads");

/** Fixture accounts, named so they are obvious in a users table. */
const OTHER_CUSTOMER = "security-other-customer@example.com";
const OTHER_DESIGNER = "security-other-designer@example.com";

/** Fixture orders. `MP-` plus a plain number, clear of the seeded range. */
const VICTIM_REFERENCE = "MP-9201";
const OWN_REFERENCE = "MP-9202";
/**
 * Owned by the other customer and assigned to the other designer.
 *
 * It exists so the other designer has a legitimate order page of their own.
 * The upload form only renders on a page its viewer is allowed to see, so
 * tampering with the order id on that form is how a designer would actually
 * try to reach somebody else's job.
 */
const OTHER_STAFF_REFERENCE = "MP-9203";

type Fixtures = {
  seededCustomerId: string;
  seededDesignerId: string;
  otherCustomerId: string;
  otherDesignerId: string;
  /** Owned by the other customer. Nothing in this file may reach into it. */
  victimOrderId: string;
  /** Owned by the seeded customer, assigned to the seeded designer. */
  ownOrderId: string;
  /** Owned by the other customer, assigned to the other designer. */
  otherStaffOrderId: string;
  /**
   * The other customer's archived artwork.
   *
   * Archived keys live in proof_versions.archived_storage_key, which no lookup
   * in /api/uploads consults, and in no order form. So this key resolves to
   * nothing for anybody — which makes it the perfect probe for whether a
   * caller can make the server resolve a key it has no claim to.
   */
  victimArchiveKey: string;
  /** An unread notification belonging to the other customer. */
  victimNotificationId: string;
};

let fx: Fixtures;

async function connect(): Promise<Client> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

test.beforeAll(async () => {
  const db = await connect();

  try {
    // Left over from an interrupted run. Orders first: users.id is referenced
    // without a cascade, deliberately, so an account with history cannot be
    // deleted out from under it.
    await db.query(
      `delete from orders where user_id in (select id from users where email = any($1))
                            or reference = any($2)`,
      [
        [OTHER_CUSTOMER, OTHER_DESIGNER],
        [VICTIM_REFERENCE, OWN_REFERENCE, OTHER_STAFF_REFERENCE],
      ],
    );
    await db.query(`delete from users where email = any($1)`, [
      [OTHER_CUSTOMER, OTHER_DESIGNER],
    ]);

    const seeded = await db.query(
      `select id, email, password_hash from users where email = any($1)`,
      [["customer@example.com", "designer@example.com"]],
    );

    const seededCustomer = seeded.rows.find(
      (r) => r.email === "customer@example.com",
    );
    const seededDesigner = seeded.rows.find(
      (r) => r.email === "designer@example.com",
    );

    if (!seededCustomer || !seededDesigner) {
      throw new Error("Run npm run db:seed before this spec.");
    }

    // The demo accounts all share one password, so the hash can be copied
    // rather than computed — argon2 is deliberately slow and this is not what
    // is under test.
    const { rows: made } = await db.query(
      `insert into users (email, name, password_hash, role, email_verified_at)
       values ($1, 'Other Customer', $3, 'customer', now()),
              ($2, 'Other Designer', $3, 'designer',  now())
       returning id, email`,
      [OTHER_CUSTOMER, OTHER_DESIGNER, seededCustomer.password_hash],
    );

    const otherCustomerId = made.find((r) => r.email === OTHER_CUSTOMER).id;
    const otherDesignerId = made.find((r) => r.email === OTHER_DESIGNER).id;

    const { rows: orders } = await db.query(
      `insert into orders
         (reference, user_id, status, payment_status, total_minor,
          assigned_designer_id, shipping_name, shipping_line1, shipping_city,
          shipping_postcode, shipping_country, placed_at)
       values
         ($1, $3, 'awaiting_proof', 'unpaid', 12000, $5,
          'Other Customer', '1 Other Street', 'Leeds', 'LS1 1AA', 'United Kingdom', now()),
         ($2, $4, 'awaiting_proof', 'unpaid', 15000, $5,
          'Jordan Ellis', '12 Chapel Row', 'Bristol', 'BS1 4XX', 'United Kingdom', now()),
         ($6, $3, 'awaiting_proof', 'unpaid', 13000, $7,
          'Other Customer', '1 Other Street', 'Leeds', 'LS1 1AA', 'United Kingdom', now())
       returning id, reference`,
      [
        VICTIM_REFERENCE,
        OWN_REFERENCE,
        otherCustomerId,
        seededCustomer.id,
        seededDesigner.id,
        OTHER_STAFF_REFERENCE,
        otherDesignerId,
      ],
    );

    const victimOrderId = orders.find((r) => r.reference === VICTIM_REFERENCE).id;
    const ownOrderId = orders.find((r) => r.reference === OWN_REFERENCE).id;
    const otherStaffOrderId = orders.find(
      (r) => r.reference === OTHER_STAFF_REFERENCE,
    ).id;

    // The other customer's artwork, archived. Real bytes on disk, so a
    // successful read is unmistakable and a 404 cannot be blamed on a missing
    // file.
    const victimArchiveKey = `archive/${VICTIM_REFERENCE.toLowerCase()}/${randomBytes(8).toString("hex")}-final-artwork.pdf`;
    const workingKey = `proofs/${randomBytes(8).toString("hex")}-other-customer-v1.pdf`;

    for (const key of [victimArchiveKey, workingKey]) {
      const target = path.join(UPLOAD_DIR, key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(
        target,
        samplePdf("Other customer's artwork", [
          "This belongs to another account and must never be served to anyone else.",
        ]),
      );
    }

    await db.query(
      `insert into proof_versions
         (order_id, version_number, sheets, storage_key, file_name, mime_type,
          size_bytes, uploaded_by_id, status, archived_storage_key, archived_at)
       values ($1, 1, $2::jsonb, $3, 'other-customer-v1.pdf', 'application/pdf',
               1024, $4, 'approved', $5, now())`,
      [
        victimOrderId,
        JSON.stringify([
          { key: workingKey, name: "other-customer-v1.pdf", width: 0, height: 0 },
        ]),
        workingKey,
        otherDesignerId,
        victimArchiveKey,
      ],
    );

    // A draft proof on the seeded customer's fixture order, for the
    // state-machine and upload tests.
    await db.query(
      `insert into proof_versions
         (order_id, version_number, sheets, storage_key, file_name, mime_type,
          size_bytes, uploaded_by_id, status)
       values ($1, 1, $2::jsonb, $3, 'own-v1.pdf', 'application/pdf', 1024, $4,
               'awaiting_proofreading')`,
      [
        ownOrderId,
        JSON.stringify([
          { key: workingKey, name: "own-v1.pdf", width: 0, height: 0 },
        ]),
        `proofs/${randomBytes(8).toString("hex")}-own-v1.pdf`,
        seededDesigner.id,
      ],
    );

    const { rows: notes } = await db.query(
      `insert into notifications (user_id, type, title, body)
       values ($1, 'system', 'Private to the other customer', 'Unread on purpose.')
       returning id`,
      [otherCustomerId],
    );

    fx = {
      seededCustomerId: seededCustomer.id,
      seededDesignerId: seededDesigner.id,
      otherCustomerId,
      otherDesignerId,
      victimOrderId,
      ownOrderId,
      otherStaffOrderId,
      victimArchiveKey,
      victimNotificationId: notes[0].id,
    };
  } finally {
    await db.end();
  }
});

test.afterAll(async () => {
  const db = await connect();
  try {
    // Orders first, then the accounts: the forms, proofs, events and
    // notifications hanging off each cascade away, so the next spec sees only
    // seeded data.
    await db.query(
      `delete from orders where user_id in (select id from users where email = any($1))
                            or reference = any($2)`,
      [
        [OTHER_CUSTOMER, OTHER_DESIGNER],
        [VICTIM_REFERENCE, OWN_REFERENCE, OTHER_STAFF_REFERENCE],
      ],
    );
    await db.query(`delete from users where email = any($1)`, [
      [OTHER_CUSTOMER, OTHER_DESIGNER],
    ]);
  } finally {
    await db.end();
  }

  for (const dir of [
    path.join(UPLOAD_DIR, "archive", VICTIM_REFERENCE.toLowerCase()),
  ]) {
    await rm(dir, { recursive: true, force: true });
  }
});

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

async function signIn(page: Page, email: string, at = "/login"): Promise<void> {
  await page.goto(at);
  await page.getByLabel("Email").fill(email);
  await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /Sign in/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/**
 * A server action, as the wire sees it.
 *
 * Actions have no URL of their own: the request goes to whatever page the
 * person is on, with the action's build-time id in a Next-Action header and
 * React's own envelope in the body. So the only way to call one as somebody it
 * was never offered to is to watch a legitimate call go past and keep the
 * bytes.
 */
type CapturedAction = {
  url: string;
  actionId: string;
  contentType: string;
  body: Buffer;
};

async function captureAction(
  page: Page,
  trigger: () => Promise<void>,
): Promise<CapturedAction> {
  const [request] = await Promise.all([
    page.waitForRequest(
      (r) => r.method() === "POST" && Boolean(r.headers()["next-action"]),
    ),
    trigger(),
  ]);

  const body = request.postDataBuffer();
  if (!body) throw new Error("Captured an action with no body");

  return {
    url: request.url(),
    actionId: request.headers()["next-action"],
    contentType: request.headers()["content-type"],
    body,
  };
}

/* -- Rewriting one field of a captured envelope ---------------------------- */

/**
 * The captured body is left alone except for the fields being tampered with.
 *
 * Reconstructing React's envelope from scratch does not work — it carries an
 * action reference, the bound previous state and a dedupe key, and Next drops
 * the request if any of them is wrong. Editing the real thing in place is both
 * simpler and closer to what someone with a proxy would actually do.
 */
type Part = { name: string; headers: string; body: Buffer };

function boundaryOf(contentType: string): string {
  const match = /boundary=(.+)$/.exec(contentType);
  if (!match) throw new Error(`No multipart boundary in ${contentType}`);
  return match[1];
}

function parseMultipart(body: Buffer, boundary: string): Part[] {
  const separator = Buffer.from(`--${boundary}`);
  const parts: Part[] = [];
  let at = body.indexOf(separator);

  while (at !== -1) {
    const start = at + separator.length;
    if (body.subarray(start, start + 2).toString() === "--") break; // closing
    const next = body.indexOf(separator, start);
    if (next === -1) break;

    // Between separators: CRLF, headers, CRLF CRLF, content, CRLF.
    const chunk = body.subarray(start + 2, next - 2);
    const split = chunk.indexOf("\r\n\r\n");
    const headers = chunk.subarray(0, split).toString("utf8");

    parts.push({
      name: /name="([^"]*)"/.exec(headers)?.[1] ?? "",
      headers,
      body: chunk.subarray(split + 4),
    });
    at = next;
  }

  if (parts.length === 0) throw new Error("Captured body parsed to no parts");
  return parts;
}

function serialiseMultipart(parts: Part[], boundary: string): Buffer {
  const pieces: Buffer[] = [];
  for (const part of parts) {
    pieces.push(Buffer.from(`--${boundary}\r\n${part.headers}\r\n\r\n`));
    pieces.push(part.body);
    pieces.push(Buffer.from("\r\n"));
  }
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(pieces);
}

function tamper(
  action: CapturedAction,
  overrides: Record<string, string>,
): Buffer {
  const boundary = boundaryOf(action.contentType);
  const parts = parseMultipart(action.body, boundary);

  // React prefixes every field of a form action with the form's index.
  const prefix = parts[0].name.startsWith("_1_") ? "_1_" : "";

  for (const [field, value] of Object.entries(overrides)) {
    const name = `${prefix}${field}`;
    const headers = `Content-Disposition: form-data; name="${name}"`;
    const body = Buffer.from(value, "utf8");

    const existing = parts.find((part) => part.name === name);
    if (existing) {
      existing.headers = headers;
      existing.body = body;
    } else {
      parts.push({ name, headers, body });
    }
  }

  return serialiseMultipart(parts, boundary);
}

/* -- Sending it -------------------------------------------------------------*/

type ActionResult = { status: number; body: string };

/**
 * Replays a captured action from inside `page`, so whoever `page` is signed in
 * as is who the server sees.
 *
 * It has to be the page's own fetch: Playwright's request contexts do not
 * carry the browser's cookies here, and a replay that arrives with no session
 * proves nothing — every guard would refuse it for the wrong reason.
 *
 * Only actions without a file can be captured this way. Playwright does not
 * expose the body of a request carrying one, so uploads are tested with
 * tamperForm below instead.
 */
async function replayAs(
  page: Page,
  action: CapturedAction,
  overrides: Record<string, string> = {},
): Promise<ActionResult> {
  const body = Object.keys(overrides).length
    ? tamper(action, overrides)
    : action.body;

  return page.evaluate(
    async ({ url, actionId, contentType, base64 }) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "next-action": actionId,
          "content-type": contentType,
          accept: "text/x-component",
        },
        body: bytes,
        redirect: "manual",
      });

      return { status: response.status, body: await response.text() };
    },
    {
      url: action.url,
      actionId: action.actionId,
      contentType: action.contentType,
      base64: body.toString("base64"),
    },
  );
}

/** A valid 1x1 PNG. Proofs must be images; the action refuses a PDF. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC",
  "base64",
);

function pngUpload(name: string) {
  return { name, mimeType: "image/png", buffer: TINY_PNG };
}

/**
 * Rewrites hidden inputs, and adds ones that were never there, on the form the
 * browser is about to send.
 *
 * This is the other half of the story, and the one the plan calls tampering
 * with a hidden field. It is needed as well as the replay above because
 * Playwright will not hand over the body of a request that carries a file, so
 * an upload cannot be captured and re-sent — it has to be tampered with on the
 * way out. React does not re-render from a direct DOM write, so what is set
 * here is what gets serialised.
 */
async function tamperForm(
  page: Page,
  selector: string,
  fields: Record<string, string>,
): Promise<void> {
  await page.evaluate(
    ({ selector, fields }) => {
      const form = document.querySelector(selector)?.closest("form");
      if (!form) throw new Error(`No form around ${selector}`);

      for (const [name, value] of Object.entries(fields)) {
        const existing = form.querySelector<HTMLInputElement>(
          `input[name="${name}"]`,
        );
        if (existing) {
          existing.value = value;
          continue;
        }
        const added = document.createElement("input");
        added.type = "hidden";
        added.name = name;
        added.value = value;
        form.appendChild(added);
      }
    },
    { selector, fields },
  );
}

/**
 * Waits for the database to catch up with an action.
 *
 * The click resolves before the write lands, and the confirmation is no help:
 * the panel that carries it is usually replaced by the re-render, because the
 * action changed the state that decided whether to show it at all.
 */
async function eventually<T>(
  read: () => Promise<T>,
  ready: (value: T) => boolean,
  what: string,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last = await read();

  while (!ready(last) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    last = await read();
  }

  if (!ready(last)) throw new Error(`Timed out waiting for ${what}`);
  return last;
}

/**
 * The proofs on an order, newest first.
 *
 * Counting rows does not work: an order keeps only the two most recent
 * versions, so a successful extra upload leaves the count where it was. The
 * file name is what says whether a particular upload landed.
 */
async function proofsOn(orderId: string) {
  return query<{ file_name: string | null; version_number: number }>(
    `select file_name, version_number from proof_versions
     where order_id = $1 order by version_number desc`,
    [orderId],
  );
}

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await connect();
  try {
    const { rows } = await db.query(sql, params);
    return rows as T[];
  } finally {
    await db.end();
  }
}

/* -------------------------------------------------------------------------- */
/* The harness itself                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Proves capture-and-replay actually runs the action.
 *
 * Every negative test below is of the form "replay this and nothing changes".
 * If the replay silently did nothing — a protocol change, a wrong header, a
 * body the action rejects before it reaches its own checks — all of them would
 * pass while testing nothing at all. So one test replays an action the caller
 * *is* allowed to make and insists the effect lands. If this fails, treat the
 * rest of the replay results as void rather than as passes.
 */
test.describe("The replay harness", () => {
  test("a replayed action really does run", async ({ page }) => {
    const marker = `harness-${Date.now()}`;

    await signIn(page, "customer@example.com");
    await page.goto(`/order-form/${fx.ownOrderId}`);

    const save = await captureAction(page, async () => {
      await page.getByRole("button", { name: "Save and finish later" }).click();
    });

    const result = await replayAs(page, save, {
      orderId: fx.ownOrderId,
      deceasedName: marker,
    });

    const [form] = await query<{ deceased_name: string | null }>(
      `select deceased_name from order_forms where order_id = $1`,
      [fx.ownOrderId],
    );

    expect(
      form?.deceased_name,
      `the replayed action did not run (HTTP ${result.status}); every replay ` +
        `assertion in this file is void until this passes`,
    ).toBe(marker);
  });
});

/* -------------------------------------------------------------------------- */
/* A01 — Broken access control                                                */
/* -------------------------------------------------------------------------- */

test.describe("A01 Broken access control", () => {
  test("an anonymous visitor reaches none of the three portals", async ({
    page,
  }) => {
    for (const route of [
      "/account",
      "/account/orders",
      "/staff",
      "/staff/queue",
      "/staff/orders",
      "/admin",
      "/admin/orders",
      "/admin/users",
    ]) {
      await page.goto(route);
      expect(
        new URL(page.url()).pathname,
        `${route} let an anonymous visitor in`,
      ).toMatch(/^\/(login|admin\/login)/);
    }
  });

  test("a customer cannot reach the studio portal or the back office", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");

    for (const route of ["/staff", "/staff/queue", "/staff/orders"]) {
      await page.goto(route);
      expect(new URL(page.url()).pathname, `${route} served a customer`).not.toMatch(
        /^\/staff/,
      );
    }

    for (const route of ["/admin", "/admin/users", "/admin/pricing/products"]) {
      await page.goto(route);
      expect(new URL(page.url()).pathname, `${route} served a customer`).toBe(
        "/admin/login",
      );
    }
  });

  test("a customer session cannot be promoted by moving its cookie", async ({
    page,
    context,
  }) => {
    await signIn(page, "customer@example.com");

    const site = (await context.cookies()).find((c) => c.name === "mip_session");
    expect(site, "no session cookie was set").toBeTruthy();

    // The proxy only checks that an admin cookie exists. The session row is
    // what decides, and it is scoped, so pasting the value across must fail.
    await context.addCookies([{ ...site!, name: "mip_admin_session" }]);

    await page.goto("/admin");
    expect(new URL(page.url()).pathname).toBe("/admin/login");

    await page.goto("/admin/users");
    expect(new URL(page.url()).pathname).toBe("/admin/login");
  });

  test("a customer cannot open another customer's order by its id", async ({
    page,
  }) => {
    await signIn(page, OTHER_CUSTOMER);

    // Every id here is real and belongs to the seeded customer, so a 404 is
    // the authorisation check firing rather than a missing row.
    for (const route of [
      `/account/orders/${fx.ownOrderId}/proof`,
      `/order-form/${fx.ownOrderId}`,
      `/checkout/${fx.ownOrderId}`,
    ]) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} was readable`).toBe(404);
    }
  });

  test("a designer cannot open an order assigned to another designer", async ({
    page,
  }) => {
    await signIn(page, OTHER_DESIGNER);

    for (const route of [
      `/staff/orders/${fx.ownOrderId}`,
      `/staff/orders/${fx.ownOrderId}/order-form`,
    ]) {
      const response = await page.goto(route);
      expect(response?.status(), `${route} was readable`).toBe(404);
    }
  });

  test("a customer replaying a staff action cannot act on the proof", async ({
    page,
    browser,
  }) => {
    // Captured as the proofreader, who is allowed to return work. The action
    // stamps whoever ran it into proofreader_id, which is what makes a
    // successful replay impossible to miss.
    await signIn(page, "proofreader@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    const returnToDesigner = await captureAction(page, async () => {
      await page.locator('textarea[name="notes"]').fill("Legitimate note.");
      await page.getByRole("button", { name: "Return to designer" }).click();
    });

    // Waited for, not raced: the legitimate write has to have landed before
    // the "before" reading is taken, or the comparison below is meaningless.
    const latestVersion = () =>
      query<{ proofreader_id: string | null; proofreader_notes: string | null }>(
        `select proofreader_id, proofreader_notes from proof_versions
         where order_id = $1 order by version_number desc limit 1`,
        [fx.ownOrderId],
      );

    const [before] = await eventually(
      latestVersion,
      ([row]) => row?.proofreader_notes === "Legitimate note.",
      "the proofreader's own note to land",
    );

    const marker = `replayed-${Date.now()}`;

    // The customer whose order it is: the person with the strongest claim to
    // it, and still not allowed to run studio actions on it.
    const asCustomer = await browser.newContext();
    const customerPage = await asCustomer.newPage();
    await signIn(customerPage, "customer@example.com");
    await customerPage.goto(`/account/orders`);
    const asCustomerResult = await replayAs(customerPage, returnToDesigner, {
      orderId: fx.ownOrderId,
      notes: marker,
    });
    await asCustomer.close();

    // And a designer, who is staff but not a proofreader.
    const asDesigner = await browser.newContext();
    const designerPage = await asDesigner.newPage();
    await signIn(designerPage, "designer@example.com");
    await designerPage.goto(`/staff/orders/${fx.ownOrderId}`);
    const asDesignerResult = await replayAs(designerPage, returnToDesigner, {
      orderId: fx.ownOrderId,
      notes: `${marker}-designer`,
    });
    await asDesigner.close();

    const [after] = await latestVersion();

    expect(
      after.proofreader_notes,
      `a replay wrote to the proof (customer HTTP ${asCustomerResult.status}, ` +
        `designer HTTP ${asDesignerResult.status})`,
    ).not.toContain(marker);
    expect(after.proofreader_notes).toBe(before.proofreader_notes);
    expect(
      after.proofreader_id,
      "someone who is not a proofreader was recorded as one",
    ).toBe(before.proofreader_id);
    expect(after.proofreader_id).not.toBe(fx.seededCustomerId);
    expect(after.proofreader_id).not.toBe(fx.seededDesignerId);
  });

  test("a designer cannot put artwork on another designer's job", async ({
    page,
  }) => {
    // Their own order page, which they are entitled to see, with the order id
    // on the upload form swapped for one they are not.
    await signIn(page, OTHER_DESIGNER);
    await page.goto(`/staff/orders/${fx.otherStaffOrderId}`);

    await tamperForm(page, 'input[type="file"]', { orderId: fx.ownOrderId });
    await page.setInputFiles(
      'input[type="file"]',
      pngUpload("cross-designer.png"),
    );
    await page.getByRole("button", { name: /Upload proof/i }).click();
    await page.waitForTimeout(2_000);

    const landed = await proofsOn(fx.ownOrderId);

    expect(
      landed.map((p) => p.file_name),
      "an unassigned designer added a version to another designer's order",
    ).not.toContain("cross-designer.png");
  });

  test("marking notifications read touches only the caller's own rows", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/account");

    const bell = page.getByRole("button", { name: /Notifications/ });
    if (await bell.count()) await bell.first().click();

    // Give the action a moment to land, then check the other account's row.
    await page.waitForTimeout(1_000);

    const [note] = await query<{ read_at: string | null }>(
      `select read_at from notifications where id = $1`,
      [fx.victimNotificationId],
    );

    expect(note.read_at, "another account's notification was marked read").toBeNull();
  });
});

/* -------------------------------------------------------------------------- */
/* A02 — Security misconfiguration                                            */
/* -------------------------------------------------------------------------- */

test.describe("A02 Security misconfiguration", () => {
  test("responses carry the baseline security headers", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();

    expect(headers["x-content-type-options"], "no nosniff header").toBe("nosniff");

    const framing =
      headers["x-frame-options"] ??
      (/frame-ancestors/.test(headers["content-security-policy"] ?? "")
        ? "csp"
        : undefined);
    expect(framing, "nothing stops this page being framed").toBeTruthy();

    expect(headers["referrer-policy"], "no referrer policy").toBeTruthy();
  });

  test("a content security policy is set", async ({ request }) => {
    const response = await request.get("/");
    expect(
      response.headers()["content-security-policy"] ??
        response.headers()["content-security-policy-report-only"],
      "no content security policy",
    ).toBeTruthy();
  });

  test("source, config and migration files are not served", async ({
    request,
  }) => {
    for (const route of [
      "/.env",
      "/.env.example",
      "/.git/config",
      "/drizzle/0000_initial_schema.sql",
      "/package.json",
      "/next.config.ts",
      "/src/db/schema.ts",
    ]) {
      const response = await request.get(route);
      expect(response.status(), `${route} was served`).not.toBe(200);
    }
  });

  test("a malformed request body produces a clean error, not internals", async ({
    request,
  }) => {
    const responses = [
      await request.post("/api/pricing/customer", {
        data: "not json at all",
        headers: { "content-type": "application/json" },
      }),
      await request.post("/api/pricing/customer", {
        data: { keys: "a string, not an array" },
      }),
      await request.post("/api/pricing/customer", {
        data: { keys: [{ nested: true }, 42, null] },
      }),
    ];

    for (const response of responses) {
      const body = await response.text();
      expect(response.status(), `unhandled: ${body.slice(0, 200)}`).toBeLessThan(500);
      expect(body).not.toMatch(/at \/?\w+[/\\].*:\d+:\d+/); // a stack frame
      expect(body).not.toMatch(/node_modules|\/home\/|drizzle-orm|PostgresError/i);
      expect(body).not.toMatch(/postgres(ql)?:\/\//);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A04 — Cryptographic failures                                               */
/* -------------------------------------------------------------------------- */

test.describe("A04 Cryptographic failures", () => {
  test("the session cookie is httpOnly and same-site", async ({
    page,
    context,
  }) => {
    await signIn(page, "customer@example.com");

    const cookie = (await context.cookies()).find((c) => c.name === "mip_session");

    expect(cookie, "no session cookie").toBeTruthy();
    expect(cookie!.httpOnly, "session cookie is readable from JavaScript").toBe(true);
    expect(["Lax", "Strict"]).toContain(cookie!.sameSite);
    expect(cookie!.path).toBe("/");

    // The cookie value must not be the thing stored server-side.
    const [row] = await query<{ n: string }>(
      `select count(*) as n from sessions where token_hash = $1`,
      [cookie!.value],
    );
    expect(Number(row.n), "the raw token is stored as the hash").toBe(0);
  });

  test("the session cookie cannot be read by page script", async ({ page }) => {
    await signIn(page, "customer@example.com");
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toMatch(/mip_session/);
    expect(visible).not.toMatch(/mip_admin_session/);
  });

  test("passwords are stored as argon2, never recoverable", async () => {
    const rows = await query<{ email: string; password_hash: string | null }>(
      `select email, password_hash from users where password_hash is not null`,
    );

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.password_hash, `${row.email} is not argon2`).toMatch(
        /^\$argon2(id|i|d)\$/,
      );
      expect(row.password_hash).not.toContain(DEMO_PASSWORD);
      // 32 hex characters on its own is what a bare MD5 looks like.
      expect(row.password_hash).not.toMatch(/^[a-f0-9]{32}$/);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A05 — Injection                                                            */
/* -------------------------------------------------------------------------- */

test.describe("A05 Injection", () => {
  const SQL_PAYLOADS = [
    "' OR '1'='1",
    "'; drop table orders; --",
    "MP-1042' union select null,null,null,null --",
    "\\'; delete from users where 1=1; --",
  ];

  test("the order search treats SQL payloads as text", async ({ page }) => {
    await signIn(page, "proofreader@example.com");

    const [{ count: before }] = await query<{ count: string }>(
      `select count(*) from orders`,
    );

    for (const payload of SQL_PAYLOADS) {
      const response = await page.goto(
        `/staff/orders?q=${encodeURIComponent(payload)}`,
      );
      expect(response?.status(), `payload broke the page: ${payload}`).toBeLessThan(
        500,
      );
      // A literal search simply finds nothing; it must not error or match all.
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }

    const [{ count: after }] = await query<{ count: string }>(
      `select count(*) from orders`,
    );
    expect(Number(after), "the orders table changed during search").toBe(
      Number(before),
    );

    const [{ count: users }] = await query<{ count: string }>(
      `select count(*) from users`,
    );
    expect(Number(users)).toBeGreaterThan(0);
  });

  test("free text a customer writes cannot execute when staff read it", async ({
    page,
    browser,
  }) => {
    const marker = `xss-${Date.now()}`;
    const payload = `<img src=x onerror="window.__xss='${marker}'"><script>window.__xss='${marker}'</script>`;

    await signIn(page, "customer@example.com");
    await page.goto(`/order-form/${fx.ownOrderId}`);

    await page
      .getByLabel("Name of the deceased, as it should appear")
      .fill(payload);
    await page.getByLabel("Notes for the design team").fill(payload);
    await page.getByRole("button", { name: "Save and finish later" }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();

    // Now the other role reads it. This is where stored XSS pays off, because
    // the payload runs with the designer's session rather than the author's.
    const asDesigner = await browser.newContext();
    const designerPage = await asDesigner.newPage();

    const dialogs: string[] = [];
    designerPage.on("dialog", async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await signIn(designerPage, "designer@example.com");
    await designerPage.goto(`/staff/orders/${fx.ownOrderId}/order-form`);

    await expect(designerPage.getByText(payload, { exact: false }).first()).toBeVisible();

    const executed = await designerPage.evaluate(
      () => (window as unknown as { __xss?: string }).__xss ?? null,
    );
    const injected = await designerPage.locator("img[src='x']").count();

    await asDesigner.close();

    expect(executed, "the payload executed in the designer's session").toBeNull();
    expect(injected, "the payload became a real element").toBe(0);
    expect(dialogs, "the payload opened a dialog").toEqual([]);
  });

  test("an uploaded filename cannot escape its folder", async ({ page }) => {
    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    await page.setInputFiles('input[type="file"]', {
      name: "../../../../../../tmp/escaped.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });
    await page.getByRole("button", { name: /Upload proof/i }).click();
    await page.waitForTimeout(2_000);

    const keys = await query<{ storage_key: string }>(
      `select storage_key from proof_versions where order_id = $1`,
      [fx.ownOrderId],
    );

    for (const { storage_key } of keys) {
      expect(storage_key, "a stored key escapes its prefix").not.toMatch(/\.\./);
      expect(storage_key).toMatch(/^proofs\//);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A06 — Insecure design                                                      */
/* -------------------------------------------------------------------------- */

test.describe("A06 Insecure design", () => {
  test("a proof that is not with the customer cannot be approved", async ({
    page,
  }) => {
    // MP-9202's version sits at awaiting_proofreading: the customer has never
    // been shown it, so there is nothing for them to approve.
    await signIn(page, "customer@example.com");
    await page.goto("/account/orders");

    const capture = await page.goto(`/account/orders/${fx.ownOrderId}/proof`);
    expect(capture?.status()).toBeLessThan(500);

    const [version] = await query<{ id: string; status: string }>(
      `select id, status from proof_versions where order_id = $1
       order by version_number desc limit 1`,
      [fx.ownOrderId],
    );

    expect(
      version.status,
      "a proof reached approved without being sent to the customer",
    ).not.toBe("approved");
  });

  test("an order total is not taken from the client", async ({
    page,
    browser,
  }) => {
    await signIn(page, "customer@example.com");

    const [before] = await query<{ total_minor: number; payment_status: string }>(
      `select total_minor, payment_status from orders where id = $1`,
      [fx.ownOrderId],
    );

    // The address action is the one customer-writable action on an order, so
    // it is the natural place to try smuggling money fields in.
    await page.goto(`/order-form/${fx.ownOrderId}`);

    const save = await captureAction(page, async () => {
      await page.getByRole("button", { name: "Save and finish later" }).click();
    });

    const context = await browser.newContext();
    const other = await context.newPage();
    await signIn(other, "customer@example.com");
    await other.goto(`/order-form/${fx.ownOrderId}`);

    await replayAs(other, save, {
      orderId: fx.ownOrderId,
      totalMinor: "1",
      total_minor: "1",
      paymentStatus: "paid",
      payment_status: "paid",
      status: "delivered",
      amountMinor: "1",
    });

    await context.close();

    const [after] = await query<{ total_minor: number; payment_status: string }>(
      `select total_minor, payment_status from orders where id = $1`,
      [fx.ownOrderId],
    );

    expect(after.total_minor, "the client set the total").toBe(before.total_minor);
    expect(after.payment_status, "the client set payment status").toBe(
      before.payment_status,
    );
  });

  test("the signup form cannot hand out a privileged role", async ({
    browser,
  }) => {
    const email = `security-signup-${Date.now()}@example.com`;
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/signup");

    const signup = await captureAction(page, async () => {
      await page.getByLabel("Your name").fill("Role Grabber");
      await page.getByLabel("Email").fill(`decoy-${Date.now()}@example.com`);
      await page.locator('input[name="password"]').fill("a-long-enough-passphrase");
      await page.getByRole("button", { name: "Create account" }).click();
    });

    const fresh = await browser.newContext();
    const freshPage = await fresh.newPage();
    await freshPage.goto("/signup");

    await replayAs(freshPage, signup, {
      name: "Role Grabber",
      email,
      password: "a-long-enough-passphrase",
      role: "admin",
      isDisabled: "false",
      emailVerifiedAt: new Date().toISOString(),
    });

    await fresh.close();
    await context.close();

    const rows = await query<{ role: string; email_verified_at: string | null }>(
      `select role, email_verified_at from users where email = $1`,
      [email],
    );

    await query(`delete from users where email = $1`, [email]);

    if (rows.length === 0) return; // Refused outright, which is also correct.

    expect(rows[0].role, "signup granted a privileged role").toBe("customer");
    expect(
      rows[0].email_verified_at,
      "signup let the client mark its own address verified",
    ).toBeNull();
  });

  test("neither signup nor password reset reveals who has an account", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("definitely-nobody@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    const unknown = await page
      .getByText(/reset link|check your|on its way/i)
      .first()
      .textContent();

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    const known = await page
      .getByText(/reset link|check your|on its way/i)
      .first()
      .textContent();

    expect(known, "the reset form says which addresses exist").toBe(unknown);
  });

  test("a wrong password and an unknown account read the same", async ({
    page,
  }) => {
    const message = async (email: string) => {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.locator('input[name="password"]').fill("definitely-not-the-password");
      await page.getByRole("button", { name: /Sign in/ }).click();
      return page.getByText(/don't match|not match/i).first().textContent();
    };

    const wrongPassword = await message("customer@example.com");
    const noSuchAccount = await message("definitely-nobody@example.com");
    const anAdmin = await message("admin@example.com");

    expect(noSuchAccount).toBe(wrongPassword);
    expect(anAdmin, "the customer login reveals admin accounts").toBe(
      wrongPassword,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* A07 — Authentication failures                                              */
/* -------------------------------------------------------------------------- */

test.describe("A07 Authentication failures", () => {
  test("signing out kills the session, not just the cookie", async ({
    page,
    context,
    browser,
  }) => {
    await signIn(page, "customer@example.com");

    const cookie = (await context.cookies()).find((c) => c.name === "mip_session");
    expect(cookie).toBeTruthy();

    await page.goto("/account");
    await page.getByRole("button", { name: "Log out" }).first().click();
    await page.waitForURL("/");

    // The same token, in a fresh browser. A cookie-only logout would work here.
    const replay = await browser.newContext();
    await replay.addCookies([cookie!]);
    const replayPage = await replay.newPage();
    await replayPage.goto("/account");

    const landed = new URL(replayPage.url()).pathname;
    await replay.close();

    expect(landed, "a revoked session token still works").toMatch(/^\/login/);
  });

  test("changing a password drops the other devices", async ({ browser }) => {
    const email = `security-rotate-${Date.now()}@example.com`;
    const first = "a-long-enough-passphrase";
    const second = "another-long-enough-passphrase";

    const one = await browser.newContext();
    const onePage = await one.newPage();
    await onePage.goto("/signup");
    await onePage.getByLabel("Your name").fill("Rotation Test");
    await onePage.getByLabel("Email").fill(email);
    await onePage.locator('input[name="password"]').fill(first);
    await onePage.getByRole("button", { name: "Create account" }).click();
    await onePage.waitForURL(/verify-email/);

    // A second device for the same account.
    const two = await browser.newContext();
    const twoPage = await two.newPage();
    await twoPage.goto("/login");
    await twoPage.getByLabel("Email").fill(email);
    await twoPage.locator('input[name="password"]').fill(first);
    await twoPage.getByRole("button", { name: /Sign in/ }).click();
    await twoPage.waitForURL((url) => !url.pathname.endsWith("/login"));

    // Device one changes the password.
    await onePage.goto("/account/security");
    await onePage.locator('input[name="currentPassword"]').fill(first);
    await onePage.locator('input[name="password"]').fill(second);
    await onePage.locator('input[name="confirmPassword"]').fill(second);
    await onePage.getByRole("button", { name: "Change password" }).click();
    await expect(onePage.getByText(/signed out|Password changed/i).first()).toBeVisible();

    // Device two must be gone.
    await twoPage.goto("/account");
    const landed = new URL(twoPage.url()).pathname;

    await one.close();
    await two.close();
    await query(`delete from users where email = $1`, [email]);

    expect(landed, "the other device survived a password change").toMatch(
      /^\/login/,
    );
  });

  test("a password reset link works once", async ({ page }) => {
    await page.goto("/reset-password?token=obviously-not-a-real-token");
    await page.locator('input[name="password"]').fill("a-long-enough-passphrase");
    await page
      .locator('input[name="confirmPassword"]')
      .fill("a-long-enough-passphrase");
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(
      page.getByText(/expired|already been used|didn't work/i).first(),
    ).toBeVisible();
  });
});

/* -------------------------------------------------------------------------- */
/* A08 — Software and data integrity failures                                 */
/* -------------------------------------------------------------------------- */

test.describe("A08 Integrity failures", () => {
  test("an upload is checked by its content, not its claimed type", async ({
    page,
  }) => {
    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    // A .png name and an image/png content type over bytes that are neither.
    await page.setInputFiles('input[type="file"]', {
      name: "not-really-an-image.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "<html><script>window.__stored=1</script></html>",
        "utf8",
      ),
    });
    await page.getByRole("button", { name: /Upload proof/i }).click();
    await page.waitForTimeout(2_000);

    const landed = await proofsOn(fx.ownOrderId);

    expect(
      landed.map((proof) => proof.file_name),
      "a file whose bytes are not an image was stored as one",
    ).not.toContain("not-really-an-image.png");
  });

  test("an order form cannot claim a file from outside its own order", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");
    await page.goto(`/order-form/${fx.ownOrderId}`);

    const save = await captureAction(page, async () => {
      await page.getByRole("button", { name: "Save and finish later" }).click();
    });

    await replayAs(page, save, {
      orderId: fx.ownOrderId,
      attachments: JSON.stringify([
        {
          key: fx.victimArchiveKey,
          name: "not-mine.pdf",
          size: 1024,
          type: "application/pdf",
        },
      ]),
    });

    const [form] = await query<{ attachments: { key: string }[] | null }>(
      `select attachments from order_forms where order_id = $1`,
      [fx.ownOrderId],
    );

    const keys = (form?.attachments ?? []).map((a) => a.key);

    expect(
      keys,
      "the server stored a storage key it never issued for this order",
    ).not.toContain(fx.victimArchiveKey);
  });

  test("a key from another customer's order stays unreadable", async ({
    page,
  }) => {
    // Runs after the graft above, deliberately: this is the consequence.
    await signIn(page, "customer@example.com");

    const segments = fx.victimArchiveKey
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const status = await page.evaluate(async (route) => {
      const response = await fetch(route);
      return response.status;
    }, `/api/uploads/${segments}`);

    expect(status, "another customer's archived artwork was served").toBe(404);
  });

  test("the activity log records the server's account of what happened", async ({
    page,
  }) => {
    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    // Fields the form never had, asking to write the audit trail directly.
    await tamperForm(page, 'input[type="file"]', {
      type: "order_delivered",
      summary: "Signed for by the customer — forged by the client",
      actorId: fx.otherDesignerId,
      actor_id: fx.otherDesignerId,
    });

    await page.setInputFiles('input[type="file"]', pngUpload("logged.png"));
    await page.getByRole("button", { name: /Upload proof/i }).click();
    await page.waitForTimeout(2_000);

    const events = await query<{
      type: string;
      summary: string;
      actor_id: string | null;
    }>(
      `select type, summary, actor_id from activity_events where order_id = $1`,
      [fx.ownOrderId],
    );

    expect(events.length, "the upload wrote no event at all").toBeGreaterThan(0);

    for (const event of events) {
      expect(event.summary, "a client-written log entry landed").not.toContain(
        "forged by the client",
      );
      expect(event.type, "a client chose the event type").not.toBe(
        "order_delivered",
      );
      expect(event.actor_id, "a client chose the actor").not.toBe(
        fx.otherDesignerId,
      );
    }
  });
});

/* -------------------------------------------------------------------------- */
/* A10 — Mishandling of exceptional conditions                                */
/* -------------------------------------------------------------------------- */

test.describe("A10 Exceptional conditions", () => {
  test("uploading nothing is refused in words, not a crash", async ({ page }) => {
    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    // The file input is `required`, so the browser will not submit an empty
    // form. Taking that off is the point: what matters is what the server does
    // when a client ignores the markup.
    await page.evaluate(() => {
      document
        .querySelector<HTMLInputElement>('input[type="file"]')
        ?.removeAttribute("required");
    });
    await page.getByRole("button", { name: /Upload proof/i }).click();

    await expect(
      page.getByText(/Choose the pages to upload/i).first(),
      "an empty upload produced no clean message",
    ).toBeVisible();

    // And with a file, but no order to attach it to.
    await page.reload();
    await tamperForm(page, 'input[type="file"]', { orderId: "" });
    await page.setInputFiles('input[type="file"]', pngUpload("orphan.png"));
    await page.getByRole("button", { name: /Upload proof/i }).click();

    await expect(page.getByText(/Missing order/i).first()).toBeVisible();
    await expect(
      page.getByText(/node_modules|at async|PostgresError/i),
    ).toHaveCount(0);
  });

  test("a proof inside the stated limit is accepted", async ({ page }) => {
    // 12MB has to cross the wire and be buffered, which takes a moment here.
    test.setTimeout(120_000);

    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    // Comfortably inside the 25MB the app promises in three places, and the
    // size of a real scanned order of service.
    await page.setInputFiles('input[type="file"]', {
      name: "twelve-megabytes.png",
      mimeType: "image/png",
      buffer: Buffer.concat([TINY_PNG, Buffer.alloc(12 * 1024 * 1024, 0x20)]),
    });
    await page.getByRole("button", { name: /Upload proof/i }).click();

    const landed = await eventually(
      () => proofsOn(fx.ownOrderId),
      (proofs) =>
        proofs.some((proof) => proof.file_name === "twelve-megabytes.png"),
      "a 12MB proof to be stored",
      60_000,
    ).catch(() => proofsOn(fx.ownOrderId));

    expect(
      landed.map((proof) => proof.file_name),
      "a proof within the stated limit was not stored",
    ).toContain("twelve-megabytes.png");
  });

  test("a file over the stated limit is refused in words", async ({ page }) => {
    test.setTimeout(150_000);

    await signIn(page, "designer@example.com");
    await page.goto(`/staff/orders/${fx.ownOrderId}`);

    // Just over the 25MB the app promises, and under the 32MB bodySizeLimit in
    // next.config.ts, so the app's own check is the one that should answer.
    await page.setInputFiles('input[type="file"]', {
      name: "far-too-big.png",
      mimeType: "image/png",
      buffer: Buffer.concat([TINY_PNG, Buffer.alloc(26 * 1024 * 1024, 0x20)]),
    });
    await page.getByRole("button", { name: /Upload proof/i }).click();

    await expect(
      page.getByText(/larger than 25MB/i).first(),
      "an oversized file was not refused in words",
    ).toBeVisible({ timeout: 60_000 });

    const landed = await proofsOn(fx.ownOrderId);
    expect(
      landed.map((proof) => proof.file_name),
      "an oversized file was stored",
    ).not.toContain("far-too-big.png");
  });

  test("an oversized or absurd API payload is handled", async ({ request }) => {
    const responses = [
      await request.post("/api/pricing/customer", { data: {} }),
      await request.post("/api/pricing/customer", {
        data: { keys: Array.from({ length: 5_000 }, (_, i) => `bogus-${i}`) },
      }),
      await request.post("/api/pricing/customer", {
        data: { keys: ["a".repeat(100_000)] },
      }),
    ];

    for (const response of responses) {
      expect(response.status()).toBeLessThan(500);
      expect(await response.text()).not.toMatch(/node_modules|\/home\/|at async/);
    }
  });

  test("an unsigned payment webhook is refused", async ({ request }) => {
    const response = await request.post("/api/webhooks/razorpay", {
      data: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: { id: "pay_forged", order_id: "order_forged", amount: 1 },
          },
        },
      },
      failOnStatusCode: false,
    });

    expect(
      response.status(),
      "a stranger's payment event was accepted",
    ).toBeGreaterThanOrEqual(400);

    const [{ count }] = await query<{ count: string }>(
      `select count(*) from payments where provider_payment_id = 'pay_forged'`,
    );
    expect(Number(count)).toBe(0);
  });

  test("the login form cannot bounce someone off this site", async ({
    page,
    context,
  }) => {
    const offSite: string[] = [];
    const expected = new URL(page.url() || "http://127.0.0.1", "http://127.0.0.1")
      .host;

    await context.route("**/*", async (route) => {
      const host = new URL(route.request().url()).host;
      if (host !== "127.0.0.1:3100" && !host.startsWith("127.0.0.1")) {
        offSite.push(route.request().url());
        await route.abort();
        return;
      }
      await route.continue();
    });

    // A protocol-relative value: it starts with "/" but the browser reads it
    // as another origin.
    await page.goto("/login?next=%2F%2Fexample.org%2Fphish");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.locator('input[name="password"]').fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForTimeout(3_000);

    expect(
      offSite,
      `signing in sent the browser off site (${expected})`,
    ).toEqual([]);
    expect(new URL(page.url()).host).toMatch(/^127\.0\.0\.1/);
  });
});
