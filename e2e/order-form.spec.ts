import * as dotenv from "dotenv";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

// The web server gets its environment from playwright.config; the test
// process does not, and this spec reads the seeded enquiry id itself.
dotenv.config();

/**
 * The order form a family fills in once their enquiry becomes an order.
 *
 * The enquiry id in the link is the only credential, so the id is read from
 * the seeded database rather than guessed.
 */
let enquiryId: string;

const REFERENCE = "ENQ-9001";

test.beforeAll(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Its own enquiry rather than a seeded one, so no other spec can convert,
  // cancel or otherwise disturb the row this file depends on.
  //
  // The reference has to be ENQ- plus a plain number: the app derives the
  // next reference by stripping non-digits and casting to int, so a
  // timestamp in here overflows int4 and breaks every enquiry submitted
  // afterwards. 9001 is clear of the seeded ones and small enough to be safe.
  await client.query(`delete from enquiries where reference = $1`, [REFERENCE]);

  const { rows } = await client.query(
    `insert into enquiries (reference, name, email, category, subject, message)
     values ($1, 'Order form test', 'order-form@example.com', 'funeral',
             'Order of service', 'Raised by the end-to-end suite.')
     returning id`,
    [REFERENCE],
  );
  enquiryId = rows[0].id;
  await client.end();
});

test.afterAll(async () => {
  // Leaves the database as it was found, so the specs that run afterwards
  // see only the seeded data.
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query(`delete from enquiries where reference = $1`, [REFERENCE]);
  await client.end();
});

test.describe("The order form", () => {
  test("turns away anyone without a real link", async ({ page }) => {
    const unknown = await page.goto(
      "/order-form/00000000-0000-4000-8000-000000000000",
    );
    expect(unknown?.status()).toBe(404);

    const malformed = await page.goto("/order-form/not-a-uuid");
    expect(malformed?.status()).toBe(404);
  });

  test("keeps itself out of search engines", async ({ page }) => {
    await page.goto(`/order-form/${enquiryId}`);

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("saves a draft, comes back to it, then submits once", async ({
    page,
  }) => {
    await page.goto(`/order-form/${enquiryId}`);

    await page
      .getByLabel("Name of the deceased, as it should appear")
      .fill("Margaret Ellen Hughes");
    await page.getByLabel("Where it is being held").fill("St Anne's, Fulwood");

    // Progressive disclosure: neither field exists until its box is ticked.
    await expect(page.getByLabel("What you have in mind")).toHaveCount(0);
    await page
      .getByLabel("I would like something designed specially")
      .check();
    await page
      .getByLabel("What you have in mind")
      .fill("A watercolour of her garden.");

    await expect(page.getByLabel("The number to call")).toHaveCount(0);
    await page.getByLabel("I would rather talk it through on the phone").check();
    await page.getByLabel("The number to call").fill("01772 000000");

    await page.getByRole("button", { name: "Save and finish later" }).click();
    await expect(page.getByText(/Saved\./)).toBeVisible();

    // The link brings back what was written, including the revealed fields.
    await page.goto(`/order-form/${enquiryId}`);
    await expect(
      page.getByLabel("Name of the deceased, as it should appear"),
    ).toHaveValue("Margaret Ellen Hughes");
    await expect(page.getByLabel("What you have in mind")).toHaveValue(
      "A watercolour of her garden.",
    );
    await expect(page.getByLabel("The number to call")).toHaveValue(
      "01772 000000",
    );

    await page.getByRole("button", { name: "Send the form" }).click();

    // Waited for, not raced: navigating away mid-submit cancels the request.
    await expect(
      page.getByRole("heading", { name: "Order form received" }),
    ).toBeVisible();

    // And the link keeps showing the confirmation rather than a blank form.
    await page.goto(`/order-form/${enquiryId}`);
    await expect(
      page.getByRole("heading", { name: "Order form received" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Send the form" })).toHaveCount(
      0,
    );
  });

  test("never writes a second form for the same enquiry", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const { rows } = await client.query(
      `select count(*)::int as n from order_forms where enquiry_id = $1`,
      [enquiryId],
    );
    await client.end();

    // A draft and a submit ran above; both had to land on the one row.
    expect(rows[0].n).toBe(1);
  });
});
