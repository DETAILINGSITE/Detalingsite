import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Edge is only exercised where it's installed (always on Windows CI runners).
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Microsoft\\Edge\\Application\\msedge.exe`,
  "/opt/microsoft/msedge/msedge",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];
const hasEdge = EDGE_PATHS.some((p) => fs.existsSync(p));

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // Own subfolder: Playwright empties outputDir on start, which would delete the Vitest and
  // bundle JSON that pnpm verify:report reads from test-results/.
  outputDir: "test-results/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["json", { outputFile: "test-results/playwright.json" }], ["html", { open: "never" }]] : [["list"], ["json", { outputFile: "test-results/playwright.json" }]],
  // Browsers run in the shop's time zone, like its customers. Under Playwright's fake clock
  // (page.clock) a browser east of Chicago — e.g. a UTC CI runner — renders the booking
  // calendar one day off from the availability data, so tests that click a day by name
  // land on the wrong day. Real clocks aren't affected; this keeps CI the same as a Central dev box.
  use: { baseURL, timezoneId: "America/Chicago", locale: "en-US", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm exec tsx scripts/e2e-server.ts",
        url: `${baseURL}/api/health`,
        timeout: 600_000,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(PORT), PAYMENTS_DRIVER: "fake", NOTIFY_DRIVER: "capture", STORAGE_DRIVER: "local", CAPTCHA_DRIVER: "test", TEST_CLOCK: "1", E2E_TEST_MODE: "1", DATABASE_URL: "postgres://detailing:detailing-local-only@127.0.0.1:54331/detailing_e2e" },
      },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] }, testIgnore: /site\.spec/ },
    { name: "mobile-safari", use: { ...devices["iPhone 15"] }, testIgnore: /(site|admin)\.spec/ },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testIgnore: /(site|admin)\.spec/ },
    { name: "site-checks", use: { ...devices["Desktop Chrome"] }, testMatch: /site\.spec/ },
    // Smoke subset on other engines
    { name: "desktop-firefox", use: { ...devices["Desktop Firefox"] }, grep: /@smoke/ },
    { name: "desktop-webkit", use: { ...devices["Desktop Safari"] }, grep: /@smoke/ },
    ...(hasEdge ? [{ name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" }, grep: /@smoke/ }] : []),
  ],
});
