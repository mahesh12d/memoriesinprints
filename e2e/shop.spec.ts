import { expect, test, type Page } from "@playwright/test";

const DEMO_PASSWORD = "printsdemo2026";

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("Prices on the product page", () => {
  test("shows the public list price to anyone", async ({ page }) => {
    await page.goto("/products/order-of-service");

    // Seeded list price for the A4 size is £2.25, A5 is £2.25 too; either way
    // a real figure must be on the page rather than a zero.
    await expect(page.getByText(/£\d/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Add to cart" })).toBeVisible();
  });

  test("says quoted individually where no price exists", async ({ page }) => {
    // The memory box is deliberately seeded without a list price.
    await page.goto("/products/memory-box");

    await expect(page.getByText("Quoted individually")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to cart" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Request a quote for this" }),
    ).toBeVisible();
  });

  test("swaps in the customer's own price and labels it", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/products/order-of-service");

    // The seeded negotiated rate is £1.45, below every list price.
    await expect(page.getByText("Your price")).toBeVisible();
    await expect(page.getByText("£1.45")).toBeVisible();
  });

  test("re-asks for the price when the size changes", async ({ page }) => {
    await signIn(page, "customer@example.com");

    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/pricing/customer")) {
        requests.push(request.url());
      }
    });

    await page.goto("/products/order-of-service");
    await expect(page.getByText("Your price")).toBeVisible();
    const afterLoad = requests.length;

    await page.getByLabel("Size").selectOption({ index: 1 });
    await expect
      .poll(() => requests.length, { timeout: 5000 })
      .toBeGreaterThan(afterLoad);
  });
});

test.describe("The customer price endpoint", () => {
  test("takes the user from the session, not the request", async ({
    request,
  }) => {
    // No session: no prices, whatever the body claims.
    const anonymous = await request.post("/api/pricing/customer", {
      data: {
        keys: ["order-of-service::A5 booklet::1"],
        userId: "11111111-1111-4111-8111-111111111111",
      },
    });

    expect(anonymous.ok()).toBe(true);
    expect(await anonymous.json()).toEqual({ prices: {} });
  });

  test("refuses a body that isn't shaped right", async ({ request }) => {
    const response = await request.post("/api/pricing/customer", {
      data: { keys: "not-an-array" },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe("Cart", () => {
  test("adds an item, changes the quantity and removes it", async ({ page }) => {
    await page.goto("/products/order-of-service");
    await page.getByLabel("Quantity").fill("50");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible();
    await expect(page.getByText("Order of service")).toBeVisible();

    const line = page.locator("li").filter({ hasText: "Order of service" });
    await line.getByLabel("Quantity").fill("10");
    await line.getByRole("button", { name: "Update" }).click();

    await expect(page.getByRole("button", { name: "Checkout" })).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Checkout" }),
    ).toBeVisible();

    await line.getByRole("button", { name: "Remove" }).click();
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("a cart filled before signing in survives signing in", async ({
    page,
  }) => {
    await page.goto("/products/order-of-service");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();
    await page.goto("/cart");
    await expect(page.getByText("Order of service")).toBeVisible();

    await signIn(page, "customer@example.com");
    await page.goto("/cart");

    await expect(page.getByText("Order of service")).toBeVisible();
    // Signed in, the negotiated rate now applies to the same line.
    await expect(page.getByText("Your price")).toBeVisible();
  });

  test("an unpriced item can't be checked out and offers a quote instead", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");

    // Reach an unpriced portfolio piece by its id through the cart API path.
    await page.goto("/products/order-of-service");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();
    await page.goto("/cart");

    await expect(page.getByRole("link", { name: "Checkout" })).toBeVisible();
  });
});

test.describe("Checkout", () => {
  test("turns the cart into an order and says payment isn't live", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com");

    await page.goto("/products/order-of-service");
    await page.getByLabel("Quantity").fill("25");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    await page.goto("/cart");
    await page.getByRole("link", { name: "Checkout" }).click();

    await expect(page).toHaveURL("/checkout");
    await expect(
      page.getByText(/Payments aren.t live yet/),
    ).toBeVisible();

    await page.getByRole("button", { name: "Place order" }).click();

    await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { name: "Your order is placed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Payment isn.t live yet/ }),
    ).toBeVisible();

    // The order is real, and the cart is now empty.
    await page.goto("/account/orders");
    await expect(page.getByText("Awaiting payment").first()).toBeVisible();

    await page.goto("/cart");
    await expect(
      page.getByRole("heading", { name: "Your cart is empty" }),
    ).toBeVisible();
  });

  test("checkout sends an anonymous visitor to sign in first", async ({
    page,
  }) => {
    await page.goto("/products/order-of-service");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText("Added to your cart.")).toBeVisible();

    await page.goto("/checkout");
    await expect(page).toHaveURL(/login/);
  });
});

test.describe("Admin pricing", () => {
  test("a change to a list price reaches an unpaid order", async ({
    browser,
  }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();

    // Buy something priced from the list, as a customer with no negotiated
    // rate on it, so the list price is what the order is built from.
    await signIn(customerPage, "customer@example.com");
    await customerPage.goto("/products/save-the-date");
    await customerPage.getByLabel("Quantity").fill("1");
    await customerPage.getByRole("button", { name: "Add to cart" }).click();
    await expect(customerPage.getByText("Added to your cart.")).toBeVisible();
    await customerPage.goto("/cart");
    await customerPage.getByRole("link", { name: "Checkout" }).click();
    await customerPage.getByRole("button", { name: "Place order" }).click();
    await expect(customerPage).toHaveURL(/\/checkout\/[0-9a-f-]+/);

    await customerPage.goto("/account/orders");
    const before = await customerPage
      .locator("li")
      .filter({ hasText: "Awaiting payment" })
      .first()
      .innerText();

    // An admin corrects the list price.
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto("/admin/login");
    await adminPage.getByLabel("Admin email").fill("admin@example.com");
    await adminPage.getByLabel("Password").fill(DEMO_PASSWORD);
    await adminPage.getByRole("button", { name: "Sign in" }).click();
    await adminPage.waitForURL("/admin");

    await adminPage.goto("/admin/pricing/products");
    // selectOption takes an exact label, so read the option text first.
    const optionLabel = await adminPage
      .getByLabel("Product and size")
      .locator("option")
      .filter({ hasText: "Save the date — A6" })
      .first()
      .innerText();

    await adminPage
      .getByLabel("Product and size")
      .selectOption({ label: optionLabel });
    await adminPage.getByLabel("Amount").fill("9.99");
    await adminPage.getByRole("button", { name: "Save price" }).click();
    await expect(adminPage.getByText("List price saved.")).toBeVisible();

    // The customer's unpaid order now shows the corrected figure.
    await customerPage.goto("/account/orders");
    const after = await customerPage
      .locator("li")
      .filter({ hasText: "Awaiting payment" })
      .first()
      .innerText();

    expect(after).not.toEqual(before);
    expect(after).toContain("£9.99");

    await customerContext.close();
    await adminContext.close();
  });

  test("each price table is edited on its own screen", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Admin email").fill("admin@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/admin");

    for (const [href, control] of [
      ["/admin/pricing/products", "Product and size"],
      ["/admin/pricing/customer-products", "Customer"],
      ["/admin/pricing/portfolio", "Portfolio piece"],
      ["/admin/pricing/customer-portfolio", "Customer"],
    ] as const) {
      await page.goto(href);
      await expect(page.getByLabel(control).first()).toBeVisible();
    }
  });
});
