import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MAIL_DIR = path.join(process.cwd(), ".mail");
const DEMO_PASSWORD = "printsdemo2026";

async function mailContaining(needle: string): Promise<string> {
  const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".html"));
  files.sort().reverse();

  for (const file of files) {
    const body = await readFile(path.join(MAIL_DIR, file), "utf8");
    if (body.includes(needle)) return body;
  }

  throw new Error(`No email containing "${needle}" in ${MAIL_DIR}`);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("Public pages", () => {
  test("the home page renders its sections and links onward", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Stationery that holds a life, and a love, with care.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Our popular designs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Common questions" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "View full portfolio →" }).click();
    await expect(page).toHaveURL("/portfolio");
  });

  test("every header link reaches a real page", async ({ page }) => {
    const destinations = [
      ["Our Work", "/portfolio", "Our work"],
      ["Products", "/products", "Our stationery"],
      ["Process", "/guide", "Your guide to working with us"],
      ["About", "/about", "A small studio, run with care"],
      ["FAQ", "/faq", "Frequently asked"],
    ] as const;

    for (const [linkName, url, heading] of destinations) {
      await page.goto("/");
      await page.getByRole("navigation").getByRole("link", { name: linkName }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("footer legal links resolve instead of 404ing", async ({ page }) => {
    for (const [label, url] of [
      ["Terms", "/terms"],
      ["Privacy", "/privacy"],
      ["Cookies", "/cookies"],
    ] as const) {
      await page.goto("/");
      await page.getByRole("contentinfo").getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("an unknown page still 404s", async ({ page }) => {
    const response = await page.goto("/not-a-real-page");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Catalogue", () => {
  test("filters the portfolio by category through the URL", async ({ page }) => {
    await page.goto("/portfolio");
    const all = await page.getByRole("listitem").count();

    await page.getByRole("link", { name: "Wedding", exact: true }).click();
    await expect(page).toHaveURL("/portfolio?category=wedding");

    await expect(
      page.getByRole("heading", { name: "Eleanor & James, Wedding Suite" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Willow Order of Service" }),
    ).toHaveCount(0);
    expect(await page.getByRole("listitem").count()).toBeLessThan(all);
  });

  test("a product page shows its sizes and routes into the quote form", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("link", { name: "View details →" }).first().click();

    await expect(page).toHaveURL(/\/products\/[a-z-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Available sizes")).toBeVisible();

    await page.getByRole("link", { name: "Request a quote for this" }).click();
    await expect(page).toHaveURL(/\/quote\?product=/);

    // The subject is prefilled from the product that was being viewed.
    await expect(page.getByLabel("What do you need?")).not.toHaveValue("");
  });

  test("an unknown product 404s rather than erroring", async ({ page }) => {
    const response = await page.goto("/products/does-not-exist");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Quote requests", () => {
  test("stores the enquiry, emails both sides and shows a reference", async ({
    page,
  }) => {
    const email = `enquiry-${Date.now()}@example.com`;
    const subject = `Order of service, ${Date.now()}`;

    await page.goto("/quote");
    await page.getByLabel("Full name").fill("Pat Morgan");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("What do you need?").fill(subject);
    await page
      .getByLabel("Project details")
      .fill("Around 80 copies for a service on the 14th, if that is possible.");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page).toHaveURL(/\/quote\/thank-you\?ref=ENQ-/);
    await expect(
      page.getByRole("heading", { name: /that’s with us/i }),
    ).toBeVisible();

    const reference = new URL(page.url()).searchParams.get("ref");
    expect(reference).toMatch(/^ENQ-\d+$/);

    // The sender gets a confirmation…
    const confirmation = await mailContaining(email);
    expect(confirmation).toContain(reference!);

    // …and the studio gets the enquiry itself.
    const studioCopy = await mailContaining(`New enquiry ${reference}`);
    expect(studioCopy).toContain("Pat Morgan");
  });

  test("rejects an empty submission with field-level errors", async ({
    page,
  }) => {
    await page.goto("/quote");

    // Bypass the browser's own required-field blocking to prove the server
    // validates too — the client check is a convenience, not the guard.
    await page.getByLabel("Full name").fill("x");
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByLabel("What do you need?").fill("Hi");
    await page.getByLabel("Project details").fill("short");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(
      page.getByText("Tell us a little more so we can quote accurately"),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/quote$/);
  });

  test("attaches the enquiry to a signed-in customer and lists it", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");

    const subject = `Wedding suite, ${Date.now()}`;
    await page.goto("/quote");

    // Contact details are prefilled from the account.
    await expect(page.getByLabel("Full name")).toHaveValue("Jordan Ellis");
    await expect(page.getByLabel("Email")).toHaveValue("customer@example.com");

    await page.getByLabel("What do you need?").fill(subject);
    await page
      .getByLabel("Project details")
      .fill("120 invitations with matching RSVP cards, for next June.");
    await page.getByRole("button", { name: "Send request" }).click();

    await expect(page).toHaveURL(/thank-you/);

    await page.goto("/account/quotes");
    await expect(page.getByText(subject)).toBeVisible();
    await expect(page.getByText("With the studio").first()).toBeVisible();
  });

  test("lets a customer cancel their own open quote", async ({ page }) => {
    await signIn(page, "customer@example.com");

    const subject = `Cancellable, ${Date.now()}`;
    await page.goto("/quote");
    await page.getByLabel("What do you need?").fill(subject);
    await page
      .getByLabel("Project details")
      .fill("A request that is about to be withdrawn by the customer.");
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page).toHaveURL(/thank-you/);

    await page.goto("/account/quotes");
    const row = page.locator("li").filter({ hasText: subject });

    await row.getByRole("button", { name: "Cancel" }).click();
    await row.getByRole("button", { name: "Yes, cancel" }).click();

    await expect(row.getByText("Cancelled")).toBeVisible();
    await expect(row.getByRole("button", { name: "Cancel" })).toHaveCount(0);
  });
});

test.describe("Account areas reached from the site", () => {
  test("the header offers the account once signed in", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/");

    await expect(
      page.getByRole("link", { name: "My account" }),
    ).toBeVisible();
  });

  test("staff see their portal link rather than a customer one", async ({
    page,
  }) => {
    await signIn(page, "designer@example.com");
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();
  });

  test("saved items and orders render for a seeded customer", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");

    await page.goto("/account/orders");
    await expect(page.getByText("MP-1039")).toBeVisible();
    await expect(page.getByText("Total spend")).toBeVisible();

    await page.goto("/account/saved");
    await expect(page.getByRole("link", { name: "Memory box" })).toBeVisible();
  });
});
