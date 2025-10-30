import { test, expect } from "@playwright/test";

/**
 * Smoke Test Template
 *
 * Fast, critical-path tests run after production deployment
 * Focus on: authentication, navigation, database connectivity, core features
 * Should complete in < 2 minutes
 */

test.describe("Production Smoke Tests", () => {
  test("authentication flow works", async ({ page }) => {
    await page.goto("/login");

    // Login with test account
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');

    // Verify successful login
    await expect(page).toHaveURL(/dashboard|home/);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test("session persists across pages", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');

    // Navigate to another page
    await page.goto("/profile");
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Verify still authenticated (not redirected to login)
    expect(page.url()).not.toContain("/login");
  });

  test("navigation links accessible", async ({ page }) => {
    await page.goto("/");

    // Check critical navigation links exist and are clickable
    const navLinks = [
      { selector: '[data-testid="nav-home"]', expectedUrl: "/" },
      { selector: '[data-testid="nav-features"]', expectedUrl: "/features" },
      { selector: '[data-testid="nav-dashboard"]', expectedUrl: "/dashboard" },
    ];

    for (const { selector, expectedUrl } of navLinks) {
      const link = page.locator(selector);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", new RegExp(expectedUrl));
    }
  });

  test("no 404s on core pages", async ({ page }) => {
    const criticalPages = ["/", "/dashboard", "/profile", "/features"];

    for (const path of criticalPages) {
      const response = await page.goto(path);
      expect(response.status()).toBeLessThan(400);
    }
  });

  test("database connectivity works", async ({ page }) => {
    // Navigate to page that requires database query
    await page.goto("/dashboard");

    // Verify data loads (not showing error state)
    await expect(page.locator('[data-testid="loading"]')).not.toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('[data-testid="error"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="data-container"]')).toBeVisible();
  });

  test("API endpoints responding", async ({ page }) => {
    // Test critical API endpoint
    const response = await page.request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe("healthy");
  });

  test("core user path - view dashboard", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');

    // Navigate to dashboard
    await page.goto("/dashboard");

    // Verify key dashboard elements visible
    await expect(page.locator('[data-testid="dashboard-stats"]')).toBeVisible();
    await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
  });

  test("core user path - create record", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');

    // Create new record
    await page.goto("/records/new");
    await page.fill('[data-testid="record-name"]', "Smoke Test Record");
    await page.click('[data-testid="save-button"]');

    // Verify success
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test("logout works", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('[data-testid="email"]', process.env.TEST_USER_EMAIL);
    await page.fill('[data-testid="password"]', process.env.TEST_USER_PASSWORD);
    await page.click('[data-testid="login-button"]');

    // Logout
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');

    // Verify redirected to login
    await expect(page).toHaveURL(/login/);
  });
});

/**
 * Usage Notes:
 *
 * 1. Smoke tests run after production deployment (~2 min max)
 * 2. Focus on critical paths only - not comprehensive testing
 * 3. Use real production environment with test user account
 * 4. Alert on any failure (email, Slack, etc.)
 * 5. Run via: npx playwright test tests/smoke/
 */
