import { expect, test, type Page } from "@playwright/test";
import { samplePdf } from "../src/lib/storage/sample-proof";

/**
 * Walks a proof the whole way round: a designer uploads it, a proofreader
 * sends it on, and the customer marks something and sends it back. These run
 * against the seeded database, so MP-1042 starts out returned to the designer
 * and MP-1039 starts out sitting with the customer.
 */

const DEMO_PASSWORD = "printsdemo2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function openOrder(page: Page, reference: string) {
  await page.goto("/staff/queue");
  await page.getByRole("link", { name: reference, exact: true }).click();
  await page.waitForURL(/\/staff\/orders\//);
}

async function uploadProof(page: Page, fileName: string) {
  await page.setInputFiles('input[type="file"]', {
    name: fileName,
    mimeType: "application/pdf",
    buffer: samplePdf("Proof", ["Uploaded by the end-to-end test"]),
  });
  await page.getByRole("button", { name: "Upload proof" }).click();
}

test.describe("The proof queue", () => {
  test("groups work by who it is waiting on", async ({ page }) => {
    await signIn(page, "proofreader@example.com");
    await page.goto("/staff/queue");

    await expect(
      page.getByRole("heading", { name: /Waiting on you/i }),
    ).toBeVisible();
    await expect(page.getByText("Needs proofreading").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "MP-1041" })).toBeVisible();
  });

  test("the dashboard counts what is outstanding", async ({ page }) => {
    await signIn(page, "proofreader@example.com");
    await page.goto("/staff");

    await expect(
      page.getByRole("heading", { name: "Studio dashboard" }),
    ).toBeVisible();
    await expect(page.getByText("Waiting on you")).toBeVisible();
    await expect(page.getByText("With the customer")).toBeVisible();
  });
});

test.describe("A proof from the studio to the customer", () => {
  test("a designer uploads a new version after it was returned", async ({
    page,
  }) => {
    await signIn(page, "designer@example.com");
    await openOrder(page, "MP-1042");

    // The proofreader's note is the reason this came back.
    await expect(page.getByText(/Returned:/)).toBeVisible();

    await uploadProof(page, "invitation-v2.pdf");

    await expect(page.getByText(/Version 2/).first()).toBeVisible();
    await expect(page.getByText("Needs proofreading").first()).toBeVisible();
  });

  test("a designer cannot send a proof to the customer", async ({ page }) => {
    await signIn(page, "designer@example.com");
    await openOrder(page, "MP-1042");

    await expect(
      page.getByRole("button", { name: /send to the customer/i }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/Only a proofreader or admin can change this/),
    ).toBeVisible();
  });

  test("a proofreader sends it on, and the customer is told", async ({
    page,
  }) => {
    await signIn(page, "proofreader@example.com");
    await openOrder(page, "MP-1042");

    await page
      .getByRole("button", { name: /Approve and send to the customer/i })
      .click();
    await expect(page.getByText("With the customer").first()).toBeVisible();

    // The customer's bell picks it up.
    await signIn(page, "customer@example.com");
    await page.goto("/account");
    await expect(
      page.getByRole("button", { name: /Notifications, \d+ unread/ }),
    ).toBeVisible();
  });
});

test.describe("The customer reviewing a proof", () => {
  test("marks a spot and sends it back", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/account/orders");

    await page
      .getByRole("link", { name: "Review your proof for MP-1042" })
      .click();
    await page.waitForURL(/\/proof$/);

    await expect(
      page.getByRole("heading", { name: "Your proof is ready" }),
    ).toBeVisible();

    // Click the artwork to drop a pin, then say what is wrong there.
    const surface = page.locator(".cursor-crosshair");
    await expect(surface).toBeVisible();
    await surface.click({ position: { x: 120, y: 160 } });

    await page.getByRole("textbox").first().fill("The date should be the 19th.");
    await page.getByRole("button", { name: "Add comment" }).click();

    await expect(page.getByText("Comments (1)")).toBeVisible();

    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(
      page.getByRole("heading", { name: "Changes requested" }),
    ).toBeVisible();
  });

  test("cannot request changes without marking anything", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/account/orders");

    // MP-1039 is sitting with the customer with no comments on version 2.
    await page
      .getByRole("link", { name: "Review your proof for MP-1039" })
      .click();
    await page.waitForURL(/\/proof$/);

    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText(/mark what needs changing/i)).toBeVisible();
  });

  test("someone else's proof is not reachable", async ({ page }) => {
    await signIn(page, "designer@example.com");

    const response = await page.goto(
      "/account/orders/00000000-0000-0000-0000-000000000000/proof",
    );

    expect(response?.status()).toBe(404);
  });
});
