import { test, expect } from "@playwright/test";

/**
 * Visual Regression Test Template
 *
 * Tag tests with @visual to run them separately in CI/CD
 * Use toHaveScreenshot() to compare against baseline images
 */

test.describe("Visual Regression Tests", () => {
  test("page displays correctly - full page @visual", async ({ page }) => {
    await page.goto("/your-page");

    // Wait for key elements to load
    await page.waitForSelector('[data-testid="main-content"]');

    // Take full page screenshot and compare to baseline
    await expect(page).toHaveScreenshot("page-full.png", {
      fullPage: true,
      maxDiffPixels: 100, // Tolerance for minor rendering differences
    });
  });

  test("component displays correctly @visual", async ({ page }) => {
    await page.goto("/your-page");
    await page.waitForSelector('[data-testid="component"]');

    // Screenshot specific component
    const component = page.locator('[data-testid="component"]');
    await expect(component).toHaveScreenshot("component.png", {
      maxDiffPixels: 50,
    });
  });

  test("empty state displays correctly @visual", async ({ page }) => {
    // Set up empty state (via API or database helper)
    await page.goto("/your-page");
    await page.waitForSelector('[data-testid="empty-state"]');

    await expect(page).toHaveScreenshot("page-empty.png", {
      fullPage: true,
    });
  });

  test("responsive design - mobile @visual", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto("/your-page");
    await page.waitForSelector('[data-testid="main-content"]');

    await expect(page).toHaveScreenshot("page-mobile.png", {
      fullPage: true,
    });
  });

  test("responsive design - tablet @visual", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await page.goto("/your-page");
    await page.waitForSelector('[data-testid="main-content"]');

    await expect(page).toHaveScreenshot("page-tablet.png", {
      fullPage: true,
    });
  });

  test("modal displays correctly @visual", async ({ page }) => {
    await page.goto("/your-page");

    // Open modal
    await page.click('[data-testid="open-modal"]');
    await page.waitForSelector('[data-testid="modal"]');

    await expect(page).toHaveScreenshot("modal-open.png", {
      fullPage: true,
    });
  });
});

/**
 * Usage Notes:
 *
 * 1. First run generates baseline screenshots in tests/__screenshots__/
 * 2. Subsequent runs compare new screenshots to baselines
 * 3. Update baselines when design changes: npx playwright test --update-snapshots
 * 4. Review visual diffs in tests/__screenshots__/__diff_output__/
 * 5. Run only visual tests: npx playwright test --grep @visual
 */
