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
      ["Portfolio", "/portfolio", "Portfolio"],
      ["Products", "/products", "Our stationery"],
      ["Guide", "/guide", "Your guide to working with us"],
      ["About", "/about", "A small studio, run with care"],
    ] as const;

    for (const [linkName, url, heading] of destinations) {
      await page.goto("/");
      await page
        .getByRole("navigation")
        .getByRole("link", { name: linkName, exact: true })
        .click();
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

  test("filters the portfolio by style, template number and popularity", async ({
    page,
  }) => {
    const results = page.getByRole("list", { name: "Portfolio pieces" });
    const refine = page.getByRole("region", { name: "Refine this collection" });

    await page.goto("/portfolio");
    const all = await results.getByRole("listitem").count();

    // One style narrows...
    await refine.getByRole("link", { name: "Classic", exact: true }).click();
    await expect(page).toHaveURL(/style=Classic/);
    await expect(results.getByRole("listitem")).toHaveCount(3);

    // ...and a second replaces it rather than adding to it: one at a time.
    await refine.getByRole("link", { name: "Floral", exact: true }).click();
    await expect(page).toHaveURL(/style=Floral/);
    await expect(page).not.toHaveURL(/Classic/);
    await expect(results.getByRole("listitem")).toHaveCount(2);

    // Popularity is a separate filter, so it narrows the style further.
    await refine.getByRole("link", { name: "Popular", exact: true }).click();
    await expect(page).toHaveURL(/style=Floral&popular=1/);
    await expect(results.getByRole("listitem")).toHaveCount(1);

    // Choosing the chosen one clears it.
    await refine.getByRole("link", { name: "Floral", exact: true }).click();
    await expect(page).not.toHaveURL(/style=/);

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(results.getByRole("listitem")).toHaveCount(all);
  });

  test("picks a piece out by its template number", async ({ page }) => {
    const results = page.getByRole("list", { name: "Portfolio pieces" });

    await page.goto("/portfolio?template=101");

    await expect(
      page.getByRole("heading", { name: "Willow Order of Service" }),
    ).toBeVisible();
    await expect(results.getByRole("listitem")).toHaveCount(1);

    // The card names the number too, so this is scoped to the filter itself.
    await expect(
      page
        .getByRole("region", { name: "Refine this collection" })
        .getByText("Template no. 101"),
    ).toBeVisible();
  });

  test("closes the template list when you click away or press escape", async ({
    page,
  }) => {
    await page.goto("/portfolio");

    const list = page.getByLabel("Search template numbers");

    await page.getByText("Any template number").click();
    await expect(list).toBeVisible();

    // A native details stays open on an outside click; this one must not.
    await page.getByRole("heading", { name: "Portfolio" }).click();
    await expect(list).toBeHidden();

    await page.getByText("Any template number").click();
    await expect(list).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
  });

  test("searches the template numbers down to one", async ({ page }) => {
    await page.goto("/portfolio");

    await page.getByText("Any template number").click();

    const search = page.getByLabel("Search template numbers");
    await search.fill("203");

    await expect(page.getByRole("link", { name: /^203/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^101/ })).toHaveCount(0);

    // A term nothing contains says so rather than showing an empty box.
    await search.fill("999999");
    await expect(page.getByText(/No template number contains/)).toBeVisible();
  });

  test("opens a portfolio design and orders it by the quantity wanted", async ({
    page,
  }) => {
    await page.goto("/portfolio?category=funeral");
    await page.getByRole("heading", { name: "Willow Order of Service" }).click();

    await page.waitForURL(/\/portfolio\/willow-order-of-service/);
    await expect(
      page.getByRole("heading", { name: "Willow Order of Service", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Template no. 101")).toBeVisible();

    const quantity = page.getByLabel("How many do you need?");
    await expect(quantity).toHaveValue("25");

    // The stepper and the field are two ways into the same number.
    await page.getByRole("button", { name: "One more" }).click();
    await expect(quantity).toHaveValue("26");
    await page.getByRole("button", { name: "One fewer" }).click();
    await expect(quantity).toHaveValue("25");

    await quantity.fill("140");
    await expect(page.getByText("for 140")).toBeVisible();

    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByText("Willow Order of Service")).toBeVisible();
  });

  test("a design with no price asks for a quote instead of a cart", async ({
    page,
  }) => {
    await page.goto("/portfolio/eleanor-and-james-wedding-suite");

    await expect(page.getByText("Quoted individually")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask for a price" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  });

  test("a product page shows a price, a size and a way to buy", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("link", { name: "View details →" }).first().click();

    await expect(page).toHaveURL(/\/products\/[a-z-]+/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByLabel("Size")).toBeVisible();
    await expect(page.getByLabel("Quantity")).toBeVisible();
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

  test("a customer can search their own orders and get back to the shop", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill("printsdemo2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/account/orders");

    await page.getByRole("searchbox").fill("1039");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("MP-1039")).toBeVisible();
    await expect(page.getByText("MP-1041")).toHaveCount(0);

    // One click back to the shop, rather than via the logo and the homepage.
    await page.getByRole("link", { name: "Order something new" }).click();
    await expect(page).toHaveURL("/products");
  });

  test("saves a portfolio design to the account", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill("printsdemo2026");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/portfolio/autumn-memorial-cards");
    await page.getByRole("button", { name: /Save Autumn Memorial Cards/ }).click();

    await expect(page.getByText("Template saved")).toBeVisible();

    // It belongs in the same list as saved products, not a separate one.
    await page.goto("/account/saved");
    await expect(
      page.getByRole("link", { name: "Autumn Memorial Cards" }),
    ).toBeVisible();
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
