import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

import { testDatabaseUrl } from "./tests/test-database-url";

// Port 3100 keeps e2e runs clear of a dev server on 3000. Tests run against a
// production build so they exercise what ships, on the *_test database so
// they never touch dev data.
const PORT = 3100;

function testBucket(): string {
  if (!process.env.TEST_S3_BUCKET) throw new Error("TEST_S3_BUCKET is not set (see .env.example)");
  return process.env.TEST_S3_BUCKET;
}
const APP_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./tests/e2e-setup.ts",
  // The journey tests share one database and mailbox.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: APP_URL,
    // Always start fresh so the server is guaranteed to use the test database.
    reuseExistingServer: false,
    timeout: 180_000,
    env: { APP_URL, DATABASE_URL: testDatabaseUrl(), S3_BUCKET: testBucket() },
  },
});
