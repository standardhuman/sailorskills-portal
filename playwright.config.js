import { defineConfig, devices } from "@playwright/test";

/**
 * Optimized Playwright Configuration Template
 *
 * Configured for:
 * - CI/CD parallel execution
 * - Visual regression testing
 * - Cross-browser testing (optional)
 * - Fast feedback loop
 */

export default defineConfig({
  testDir: "./tests",

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for more stability (optional)
  workers: process.env.CI ? 2 : undefined,

  // Reporter to use
  reporter: [["html"], ["list"], process.env.CI ? ["github"] : ["list"]],

  use: {
    // Base URL from environment or default
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:5173",

    // Collect trace when retrying the failed test
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure
    video: "retain-on-failure",
  },

  // Configure projects for different browsers (optional - remove if only testing Chrome)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile testing (optional)
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  // Run local dev server before starting tests (optional)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5173',
  //   reuseExistingServer: !process.env.CI,
  // },
});
