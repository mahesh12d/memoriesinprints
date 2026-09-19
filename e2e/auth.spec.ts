import { expect, test, type Page } from "@playwright/test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * These walk the real flows against a real database. MAIL_TRANSPORT=log writes
 * every message to .mail/, so the verification and reset links can be read back
 * the same way a person would read them in their inbox.
 */

const MAIL_DIR = path.join(process.cwd(), ".mail");
const DEMO_PASSWORD = "printsdemo2026";

async function latestMailLink(pattern: RegExp): Promise<string> {
  const files = (await readdir(MAIL_DIR)).filter((f) => f.endsWith(".html"));
  files.sort();

  for (const file of files.reverse()) {
    const body = await readFile(path.join(MAIL_DIR, file), "utf8");
    const match = body.match(pattern);
    if (match) return match[0];
  }

  throw new Error(`No email matching ${pattern} found in ${MAIL_DIR}`);
}

/**
 * Submitting the form kicks off a server action and then a redirect, so the
 * click resolves before the session cookie has been set. Wait for the
 * navigation off /login before doing anything else, or the next goto races it.
 */
async function signIn(
  page: Page,
  email: string,
  password = DEMO_PASSWORD,
  { expectSuccess = true }: { expectSuccess?: boolean } = {},
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();

  if (expectSuccess) {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  }
}

test.describe("Signing up", () => {
  test("creates an account, emails a link, and confirms the address", async ({
    page,
  }) => {
    const email = `new-${Date.now()}@example.com`;

    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Pat Morgan");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-long-enough-passphrase");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/verify-email/);
    await expect(
      page.getByRole("heading", { name: "Confirm your email" }),
    ).toBeVisible();

    const link = await latestMailLink(/http:\/\/[^"']*verify-email\?token=[^"']+/);
    await page.goto(link);

    await expect(
      page.getByRole("heading", { name: "Email confirmed" }),
    ).toBeVisible();

    // The same link a second time must not work.
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "That link didn't work" }),
    ).toBeVisible();
  });
});

test.describe("Signing in", () => {
  test("rejects a wrong password without saying which field was wrong", async ({
    page,
  }) => {
    await signIn(page, "customer@example.com", "not-the-password", {
      expectSuccess: false,
    });

    await expect(
      page.getByText("That email and password don't match an account."),
    ).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });

  test("sends a customer to their account", async ({ page }) => {
    await signIn(page, "customer@example.com");

    await expect(page).toHaveURL("/account");
    await expect(page.getByRole("heading", { name: /Hello, Jordan/ })).toBeVisible();
  });

  test("sends studio staff to the studio portal", async ({ page }) => {
    await signIn(page, "designer@example.com");

    await expect(page).toHaveURL("/staff");
    await expect(
      page.getByRole("heading", { name: "Studio dashboard" }),
    ).toBeVisible();
  });

  test("turns admins away from the customer login", async ({ page }) => {
    await signIn(page, "admin@example.com", DEMO_PASSWORD, {
      expectSuccess: false,
    });

    await expect(
      page.getByText("Administrators sign in through the admin portal."),
    ).toBeVisible();
  });
});

test.describe("Role gates", () => {
  test("a customer cannot reach the studio portal", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/staff");

    await expect(page).toHaveURL("/account");
  });

  test("a customer session cannot reach admin", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/admin");

    await expect(page).toHaveURL(/admin\/login/);
  });

  test("an anonymous visitor is sent to sign in, and back again after", async ({
    page,
  }) => {
    await page.goto("/account/security");
    await expect(page).toHaveURL(/login\?next=%2Faccount%2Fsecurity/);

    await page.getByLabel("Email").fill("customer@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/account/security");
  });
});

test.describe("Admin portal", () => {
  test("admins sign in through their own form", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Admin email").fill("admin@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/admin");
    await expect(
      page.getByRole("heading", { name: "Business dashboard" }),
    ).toBeVisible();
  });

  test("a staff member's credentials are refused at the admin door", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Admin email").fill("proofreader@example.com");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByText("Those details don't match an admin account."),
    ).toBeVisible();
  });
});

test.describe("Password reset", () => {
  test("emails a link that sets a new password and signs every device out", async ({
    page,
  }) => {
    const email = `reset-${Date.now()}@example.com`;
    const original = "first-passphrase-here";
    const replacement = "second-passphrase-here";

    await page.goto("/signup");
    await page.getByLabel("Your name").fill("Reset Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(original);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/verify-email/);

    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/reset link is on its way/)).toBeVisible();

    const link = await latestMailLink(
      /http:\/\/[^"']*reset-password\?token=[^"']+/,
    );
    await page.goto(link);

    await page.getByLabel("New password", { exact: true }).fill(replacement);
    await page.getByLabel("Confirm new password").fill(replacement);
    await page.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/login\?reset=1/);

    // The signup session was revoked by the reset, so /account must bounce.
    await page.goto("/account");
    await expect(page).toHaveURL(/login/);

    await signIn(page, email, replacement);
    await expect(page).toHaveURL("/account");
  });

  test("gives the same answer for an unknown address", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody-here@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();

    await expect(page.getByText(/reset link is on its way/)).toBeVisible();
  });
});

test.describe("Security page", () => {
  test("lists this device and revokes the others", async ({ browser }) => {
    const email = `sessions-${Date.now()}@example.com`;
    const password = "another-long-passphrase";

    const first = await browser.newContext();
    const firstPage = await first.newPage();

    await firstPage.goto("/signup");
    await firstPage.getByLabel("Your name").fill("Session Tester");
    await firstPage.getByLabel("Email").fill(email);
    await firstPage.getByLabel("Password").fill(password);
    await firstPage.getByRole("button", { name: "Create account" }).click();
    await expect(firstPage).toHaveURL(/verify-email/);

    // A second browser, same account — two live sessions.
    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await signIn(secondPage, email, password);
    await expect(secondPage).toHaveURL("/account");

    await firstPage.goto("/account/security");
    await expect(firstPage.getByText("This device")).toBeVisible();
    await expect(
      firstPage.getByRole("button", { name: /Sign out 1 other device/ }),
    ).toBeVisible();

    await firstPage
      .getByRole("button", { name: /Sign out 1 other device/ })
      .click();

    // The second browser is now signed out.
    await secondPage.goto("/account");
    await expect(secondPage).toHaveURL(/login/);

    // The first is untouched.
    await firstPage.goto("/account");
    await expect(firstPage).toHaveURL("/account");

    await first.close();
    await second.close();
  });

  test("changing a password signs other devices out but keeps this one", async ({
    browser,
  }) => {
    const email = `change-${Date.now()}@example.com`;
    const password = "yet-another-passphrase";
    const replacement = "the-replacement-passphrase";

    const first = await browser.newContext();
    const firstPage = await first.newPage();

    await firstPage.goto("/signup");
    await firstPage.getByLabel("Your name").fill("Change Tester");
    await firstPage.getByLabel("Email").fill(email);
    await firstPage.getByLabel("Password").fill(password);
    await firstPage.getByRole("button", { name: "Create account" }).click();
    await expect(firstPage).toHaveURL(/verify-email/);

    const second = await browser.newContext();
    const secondPage = await second.newPage();
    await signIn(secondPage, email, password);
    await expect(secondPage).toHaveURL("/account");

    await firstPage.goto("/account/security");
    await firstPage.getByLabel("Current password").fill(password);
    await firstPage
      .getByLabel("New password", { exact: true })
      .fill(replacement);
    await firstPage.getByLabel("Confirm new password").fill(replacement);
    await firstPage.getByRole("button", { name: "Change password" }).click();

    await expect(firstPage.getByText(/Password changed/)).toBeVisible();

    await secondPage.goto("/account");
    await expect(secondPage).toHaveURL(/login/);

    await firstPage.goto("/account");
    await expect(firstPage).toHaveURL("/account");

    await first.close();
    await second.close();
  });
});

test.describe("Profile", () => {
  test("saves and reloads the customer's details", async ({ page }) => {
    await signIn(page, "customer@example.com");
    await page.goto("/account/profile");

    const phone = `07700 ${Date.now().toString().slice(-6)}`;
    await page.getByLabel("Phone").fill(phone);
    await page.getByLabel("Town or city").fill("Bath");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Phone")).toHaveValue(phone);
    await expect(page.getByLabel("Town or city")).toHaveValue("Bath");
  });
});
