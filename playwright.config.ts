import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Set CHROMIUM_PATH to use a Chromium that's already on the machine
        // instead of letting Playwright download its own.
        launchOptions: process.env.CHROMIUM_PATH
          ? { executablePath: process.env.CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      APP_URL: baseURL,
      MAIL_TRANSPORT: "log",
      // The suite signs in far more often than any real person would, so the
      // lockout is raised here rather than weakened in the app. The limiter's
      // own behaviour is covered by src/lib/rate-limit.test.ts.
      RATE_LIMIT_LOGIN: "500",
      RATE_LIMIT_ADMIN_LOGIN: "500",
      RATE_LIMIT_SIGNUP: "500",
      RATE_LIMIT_FORGOT: "500",
      RATE_LIMIT_ENQUIRY: "500",
    },
  },
});
