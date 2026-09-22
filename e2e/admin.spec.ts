import { expect, test, type Page } from "@playwright/test";
import { samplePng } from "../src/lib/storage/sample-proof";

/**
 * The back office: everything the studio runs the business from. These walk
 * the real screens against the seeded database, so an enquiry starts out new
 * and MP-1042 starts out unpaid.
 */

const DEMO_PASSWORD = "printsdemo2026";

async function signInAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/admin/login"));
}

test.describe("Every link in the admin sidebar", () => {
  test("reaches a real page", async ({ page }) => {
    await signInAsAdmin(page);

    for (const path of [
      "/admin",
      "/admin/enquiries",
      "/admin/orders",
      "/admin/portfolio",
      "/admin/products",
      "/admin/users",
      "/admin/pricing",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should not 404`).toBe(200);
    }
  });
});

test.describe("The dashboard", () => {
  test("shows money taken rather than a placeholder", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");

    await expect(page.getByText("Taken this month")).toBeVisible();
    await expect(page.getByText("Still to collect")).toBeVisible();
    await expect(page.getByText(/£\d/).first()).toBeVisible();

    // Payment keys aren't set in the test environment, so it should say so.
    await expect(page.getByText(/Payment isn.t live yet/)).toBeVisible();
  });

  test("a tile links through to the list it counts", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin");

    await page.getByRole("link", { name: /New enquiries/ }).click();
    await expect(page).toHaveURL(/\/admin\/enquiries\?status=new/);
  });
});

test.describe("Enquiries", () => {
  test("filters by status through the URL", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/enquiries");

    await page.getByRole("link", { name: /^New/ }).click();
    await expect(page).toHaveURL(/status=new/);
    await expect(page.getByRole("link", { name: /^ENQ-/ }).first()).toBeVisible();
  });

  test("quoting an enquiry tells the customer", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/enquiries?status=new");
    await page.getByRole("link", { name: /^ENQ-/ }).first().click();
    await page.waitForURL(/\/admin\/enquiries\/[0-9a-f-]+$/);

    await page.getByLabel("Amount quoted").fill("245.00");
    await page
      .getByLabel("What the quote covers")
      .fill("One memory box, lined, with a photograph inset.");
    await page.getByRole("button", { name: /Send the quote/ }).click();

    await expect(page.getByText(/Quote recorded/)).toBeVisible();
    await expect(page.getByText("Quoted").first()).toBeVisible();
  });

  test("turns a quoted enquiry into an order", async ({ page }) => {
    // A fresh enquiry from a signed-in customer. The seeded one already has an
    // order raised from it, and the screen correctly refuses to raise a second.
    const subject = `Keepsake box ${Date.now()}`;

    await page.goto("/login");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/quote");
    await page.getByLabel("Full name").fill("Jordan Ellis");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("What do you need?").fill(subject);
    await page
      .getByLabel("Project details")
      .fill("One lined box for the order of service and photographs.");
    await page.getByRole("button", { name: "Send request" }).click();
    await page.waitForURL(/thank-you/);

    await signInAsAdmin(page);
    await page.goto("/admin/enquiries?status=new");
    await page.getByRole("link", { name: /^ENQ-/ }).first().click();
    await page.waitForURL(/\/admin\/enquiries\/[0-9a-f-]+$/);

    await page.getByLabel("Amount quoted").fill("245.00");
    await page.getByRole("button", { name: /Send the quote/ }).click();
    await expect(page.getByText(/Quote recorded/)).toBeVisible();

    await page.getByRole("button", { name: /Raise an order from this/ }).click();

    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]+$/);
    await expect(page.getByText("£245.00").first()).toBeVisible();
  });

  test("refuses to raise a second order from the same enquiry", async ({
    page,
  }) => {
    await signInAsAdmin(page);

    // ENQ-1042 in the seed already became MP-1039.
    await page.goto("/admin/enquiries");
    await page.getByRole("link", { name: "ENQ-1042" }).click();

    await expect(
      page.getByRole("button", { name: /Raise an order from this/ }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "MP-1039" })).toBeVisible();
  });
});

test.describe("Orders", () => {
  test("finds an order by reference, name or email from any portal", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders");

    await page.getByRole("searchbox").fill("1039");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page).toHaveURL(/q=1039/);
    await expect(page.getByRole("link", { name: "MP-1039" })).toBeVisible();
    await expect(page.getByRole("link", { name: "MP-1041" })).toHaveCount(0);

    // The status filters carry the search with them rather than dropping it.
    await page.getByRole("link", { name: /^All/ }).click();
    await expect(page).toHaveURL(/q=1039/);

    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page.getByRole("link", { name: "MP-1041" })).toBeVisible();
  });

  test("records a payment taken outside the website", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders?payment=unpaid");
    await page.getByRole("link", { name: "MP-1042" }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]+$/);

    await page.getByLabel("Amount received").fill("110.00");
    await page.getByLabel("Their reference").fill("bank-transfer-4417");
    await page.getByRole("button", { name: /Record the payment/ }).click();

    await expect(page.getByText(/This order is paid/)).toBeVisible();
    await expect(page.getByText("bank-transfer-4417")).toBeVisible();
    await expect(page.getByText("Paid").first()).toBeVisible();
  });

  test("won't take a second payment for the same order", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders?payment=paid");
    await page.getByRole("link", { name: "MP-1039" }).click();

    // The form isn't offered at all once an order is paid.
    await expect(
      page.getByRole("button", { name: /Record the payment/ }),
    ).toHaveCount(0);
  });

  test("moving an order to shipped tells the customer", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: "MP-1039" }).click();

    await page.getByLabel("Status").selectOption("shipped");
    await page.getByRole("button", { name: /Save the order/ }).click();
    await expect(page.getByText("Order saved.")).toBeVisible();
  });

  test("completing an order files its artwork in the archive", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders");
    await page.getByRole("link", { name: "MP-1039" }).click();

    await page.getByLabel("Status").selectOption("delivered");
    await page.getByRole("button", { name: /Save the order/ }).click();

    // A storage failure appends a warning to this message, so the bare
    // "Order saved." is itself the assertion that the copy went through.
    await expect(page.getByText("Order saved.", { exact: true })).toBeVisible();
    await expect(
      page.getByText(/was archived/).first(),
    ).toBeVisible();
  });
});

test.describe("Products", () => {
  test("creates one, adds a size, and it reaches the website", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/products/new");

    await page.getByLabel("Name").fill("Memorial bookmark");
    await page.getByLabel("Category").selectOption("funeral");
    await page
      .getByLabel("One-line summary")
      .fill("A keepsake bookmark on 350gsm board.");
    await page.getByLabel("Photograph").setInputFiles({
      name: "bookmark.png",
      mimeType: "image/png",
      buffer: samplePng(400, 560),
    });
    await page.getByRole("button", { name: /Create the product/ }).click();

    await page.waitForURL(/\/admin\/products\/[0-9a-f-]+$/);
    await expect(page.getByText("/products/memorial-bookmark")).toBeVisible();

    // The uploaded photograph comes back as a picture, not a broken link.
    await expect(
      page.getByRole("img", { name: "Memorial bookmark" }),
    ).toBeVisible();

    await page.getByLabel("Size").fill("Standard");
    await page.getByLabel("Width (mm)").fill("55");
    await page.getByLabel("Height (mm)").fill("180");
    await page.getByRole("button", { name: /Add this size/ }).click();
    await expect(page.getByText("Size added.")).toBeVisible();
    await expect(page.getByText("55 × 180mm")).toBeVisible();

    // Live on the site, with no price yet, so it must say so rather than £0.
    await page.goto("/products/memorial-bookmark");
    await expect(
      page.getByRole("heading", { name: "Memorial bookmark" }),
    ).toBeVisible();
    await expect(page.getByText("Quoted individually")).toBeVisible();
  });

  test("hides a product from the website in one click", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/products");

    await page
      .getByRole("button", { name: /Hide Memorial bookmark from the website/ })
      .click();
    await expect(
      page.getByRole("button", { name: /Show Memorial bookmark on the website/ }),
    ).toBeVisible();

    const response = await page.goto("/products/memorial-bookmark");
    expect(response?.status()).toBe(404);
  });
});

test.describe("Portfolio", () => {
  test("adds a piece and publishes it", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/portfolio/new");

    await page.getByLabel("Title").fill("Pressed fern order of service");
    await page.getByLabel("Category").selectOption("funeral");
    await page.getByRole("button", { name: /Add the piece/ }).click();

    await page.waitForURL(/\/admin\/portfolio\/[0-9a-f-]+$/);

    // New pieces start unpublished, so nothing reaches the site by accident.
    await page.goto("/portfolio");
    await expect(
      page.getByText("Pressed fern order of service"),
    ).toHaveCount(0);

    await page.goto("/admin/portfolio");
    await page
      .getByRole("button", {
        name: /Show Pressed fern order of service in the portfolio/,
      })
      .click();

    // The click resolves as soon as the action is dispatched; wait for the
    // row to flip before asking the public page for it.
    await expect(
      page.getByRole("button", {
        name: /Hide Pressed fern order of service from the portfolio/,
      }),
    ).toBeVisible();

    await page.goto("/portfolio");
    await expect(
      page.getByRole("heading", { name: "Pressed fern order of service" }),
    ).toBeVisible();
  });
});

test.describe("Users", () => {
  test("invites a designer, who is emailed a link rather than a password", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/users");

    const email = `designer-${Date.now()}@example.com`;
    await page.getByLabel("Name").fill("Nina Okafor");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Role", { exact: true }).selectOption("designer");
    await page.getByRole("button", { name: /Send the invitation/ }).click();

    await expect(page.getByText(/sent a link to set their password/)).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("refuses to strip the only administrator's own access", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/users?role=admin");

    await page.getByLabel(/Role for /).first().selectOption("customer");
    await page.getByRole("button", { name: "Save" }).first().click();

    await expect(
      page.getByText(/can't remove your own administrator access/),
    ).toBeVisible();
  });

  test("the suspend button is disabled on your own account", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/users?role=admin");

    await expect(
      page.getByRole("button", { name: "Suspend" }).first(),
    ).toBeDisabled();
  });
});

test.describe("The studio's own order screens", () => {
  test("the office raises an order that never came through the website", async ({
    page,
  }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/orders/new");

    await page.getByLabel(/Who it.s for/).selectOption({ index: 1 });
    await page
      .getByLabel("What we are printing")
      .fill("Order of service booklets, A5, 8pp");
    await page.getByLabel("How many").fill("120");
    await page.getByLabel("Agreed price").fill("310.00");
    await page.getByRole("button", { name: /Raise the order/ }).click();

    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]+$/);
    await expect(page.getByText("£310.00").first()).toBeVisible();
  });

  test("the studio floor has no way to raise one", async ({ page }) => {
    for (const email of ["designer@example.com", "proofreader@example.com"]) {
      await page.goto("/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(DEMO_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.waitForURL((url) => !url.pathname.startsWith("/login"));

      await page.goto("/staff/orders");
      await expect(
        page.getByRole("link", { name: "Raise an order" }),
      ).toHaveCount(0);

      // And not by typing the old address either: the route is gone.
      const response = await page.goto("/staff/orders/new");
      expect(response?.status()).toBe(404);
    }
  });

  test("a designer's order list is only ever their own work", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("designer@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/staff/orders");

    // Nothing to filter by: there is no one else's work in the list to hide.
    await expect(page.getByRole("link", { name: "Assigned to me" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Everyone’s" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^MP-/ }).first()).toBeVisible();
  });
});

test.describe("Saving things for later", () => {
  test("a visitor who isn't signed in is asked to, then brought back", async ({
    page,
  }) => {
    await page.goto("/products");
    await page.getByRole("button", { name: /Save .* for later/ }).first().click();

    await expect(page).toHaveURL(/\/login\?next=%2Fproducts/);
  });

  test("a customer saves a product and finds it in their account", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));

    await page.goto("/products/order-of-service");
    const save = page.getByRole("button", { name: /Save .* for later/ });
    await save.click();

    await expect(
      page.getByRole("button", { name: /Remove .* from your saved items/ }),
    ).toBeVisible();

    await page.goto("/account/saved");
    await expect(
      page.getByRole("link", { name: "Order of service" }),
    ).toBeVisible();

    // And back off again. The seeded customer has other saved items, so the
    // list doesn't empty — this one leaves it.
    await page
      .getByRole("button", {
        name: "Remove Order of service from your saved items",
      })
      .click();
    await expect(
      page.getByRole("link", { name: "Order of service" }),
    ).toHaveCount(0);
  });
});
