import { defineConfig, devices } from "@playwright/test";

// E2E_HEADED=1 opens a real, visibly-slowed-down browser window so a human
// can watch the suite drive the app. Default (unset) stays headless for CI.
const headed = process.env.E2E_HEADED === "1";

export default defineConfig({
  testDir: "./tests-e2e",
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    headless: !headed,
    launchOptions: headed ? { slowMo: 400 } : {},
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
