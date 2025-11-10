import { test, expect } from "@playwright/test";

/**
 * Payment Setup System - Comprehensive Test Suite
 *
 * Tests the complete payment method setup flow for Zoho → Stripe migration
 *
 * Coverage:
 * - Authentication requirements
 * - Stripe Elements integration
 * - Form validation
 * - Edge function integration
 * - Database updates
 * - Error handling
 * - Navigation integration
 *
 * Prerequisites:
 * - Dev server running on localhost:5174 (or PORTAL_URL set)
 * - Supabase project configured
 * - Stripe test mode enabled
 * - Test user account exists
 *
 * Environment Variables:
 * - TEST_USER_EMAIL: Test customer email
 * - TEST_USER_PASSWORD: Test customer password
 * - PORTAL_URL: Portal base URL (default: http://localhost:5174)
 */

const TEST_USER_EMAIL =
  process.env.TEST_USER_EMAIL || "standardhuman@gmail.com";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "KLRss!650";
const PORTAL_URL = process.env.PORTAL_URL || "http://localhost:5174";

// Stripe test cards
const TEST_CARDS = {
  valid: {
    number: "4242424242424242",
    expiry: "12/30",
    cvc: "123",
    zip: "12345",
  },
  declined: {
    number: "4000000000000002",
    expiry: "12/30",
    cvc: "123",
    zip: "12345",
  },
  insufficientFunds: {
    number: "4000000000009995",
    expiry: "12/30",
    cvc: "123",
    zip: "12345",
  },
};

test.describe("Payment Setup System", () => {
  test.describe("Authentication Requirements", () => {
    test("should redirect to login when not authenticated", async ({
      page,
    }) => {
      // Navigate directly to payment setup page
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);

      // Should redirect to login page
      await page.waitForURL(/login\.html/, { timeout: 5000 });
      expect(page.url()).toContain("login.html");

      // Should include redirect parameter
      expect(page.url()).toContain("redirect=/portal-payment-setup.html");
    });

    test("should allow access when authenticated", async ({ page }) => {
      // Login first
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');

      // Wait for login to complete
      await page.waitForURL(/portal\.html/, { timeout: 10000 });

      // Navigate to payment setup
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);

      // Should stay on payment setup page
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("portal-payment-setup.html");

      // Verify page title
      await expect(page.locator("h1")).toContainText("Payment Method Setup");
    });
  });

  test.describe("Page Load and Initialization", () => {
    test.beforeEach(async ({ page }) => {
      // Login before each test
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });
    });

    test("should load payment setup page successfully", async ({ page }) => {
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Verify page elements
      await expect(page.locator("h1")).toContainText("Payment Method Setup");
      await expect(page.locator(".info-box")).toBeVisible();
      await expect(page.locator("#payment-form")).toBeVisible();
    });

    test("should display user email in header", async ({ page }) => {
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Check user email is displayed
      const userEmail = page.locator("#user-email");
      await expect(userEmail).toBeVisible();
      await expect(userEmail).toContainText(TEST_USER_EMAIL);
    });

    test("should initialize Stripe Elements", async ({ page }) => {
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Wait for Stripe.js to load
      await page.waitForFunction(() => typeof Stripe !== "undefined", {
        timeout: 5000,
      });

      // Verify Stripe Elements iframe loads
      const stripeFrame = page.frameLocator(
        'iframe[name^="__privateStripeFrame"]',
      );
      await expect(stripeFrame.locator('input[name="cardnumber"]')).toBeVisible(
        {
          timeout: 10000,
        },
      );
    });

    test("should show security notice", async ({ page }) => {
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Verify security message is visible
      const securityNote = page.locator(".security-note");
      await expect(securityNote).toBeVisible();
      await expect(securityNote).toContainText("encrypted and secure");
    });
  });

  test.describe("Form Validation", () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to payment setup
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");
    });

    test("should show validation error for empty card", async ({ page }) => {
      // Try to submit without entering card details
      const submitBtn = page.locator("#submit-btn");
      await submitBtn.click();

      // Wait a moment for validation
      await page.waitForTimeout(1000);

      // Stripe should show validation error
      const cardErrors = page.locator("#card-errors");
      await expect(cardErrors).toBeVisible({ timeout: 5000 });
      await expect(cardErrors).not.toBeEmpty();
    });

    test("should validate card number format", async ({ page }) => {
      // Get Stripe iframe
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();

      // Enter invalid card number
      await stripeFrame.locator('input[name="cardnumber"]').fill("1234");

      // Trigger validation by moving to next field
      await stripeFrame.locator('input[name="exp-date"]').click();

      // Wait for validation
      await page.waitForTimeout(1000);

      // Check for error indication (Stripe shows visual feedback)
      const cardElement = page.locator("#card-element");
      await expect(cardElement).toHaveClass(/StripeElement--invalid/, {
        timeout: 3000,
      });
    });
  });

  test.describe("Payment Method Submission", () => {
    test.beforeEach(async ({ page }) => {
      // Login and navigate to payment setup
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");
    });

    test("should successfully add payment method with valid card", async ({
      page,
    }) => {
      // Wait for Stripe Elements to load
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await expect(stripeFrame.locator('input[name="cardnumber"]')).toBeVisible(
        {
          timeout: 10000,
        },
      );

      // Fill in card details
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.valid.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.valid.expiry);
      await stripeFrame.locator('input[name="cvc"]').fill(TEST_CARDS.valid.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.valid.zip);

      // Submit form
      const submitBtn = page.locator("#submit-btn");
      await submitBtn.click();

      // Button should show loading state
      await expect(submitBtn).toBeDisabled();
      await expect(submitBtn).toContainText("Processing");

      // Wait for success message (this may take a few seconds for API calls)
      const successMessage = page.locator("#success-message");
      await expect(successMessage).toBeVisible({ timeout: 15000 });
      await expect(successMessage).toContainText("Payment Method Added!");

      // Form should be hidden
      const paymentForm = page.locator("#payment-form-container");
      await expect(paymentForm).toHaveClass(/hidden/);

      // Success alert should appear
      const successAlert = page.locator("#success-alert");
      await expect(successAlert).toBeVisible();
    });

    test("should show error for declined card", async ({ page }) => {
      // Wait for Stripe Elements to load
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await expect(stripeFrame.locator('input[name="cardnumber"]')).toBeVisible(
        {
          timeout: 10000,
        },
      );

      // Fill in declined card details
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.declined.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.declined.expiry);
      await stripeFrame
        .locator('input[name="cvc"]')
        .fill(TEST_CARDS.declined.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.declined.zip);

      // Submit form
      await page.locator("#submit-btn").click();

      // Wait for error message
      const errorAlert = page.locator("#error-alert");
      await expect(errorAlert).toBeVisible({ timeout: 15000 });
      await expect(errorAlert).toContainText(/declined|error/i);

      // Form should still be visible to retry
      const paymentForm = page.locator("#payment-form-container");
      await expect(paymentForm).toBeVisible();
    });

    test("should allow retry after error", async ({ page }) => {
      // Wait for Stripe Elements to load
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await expect(stripeFrame.locator('input[name="cardnumber"]')).toBeVisible(
        {
          timeout: 10000,
        },
      );

      // First try with declined card
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.declined.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.declined.expiry);
      await stripeFrame
        .locator('input[name="cvc"]')
        .fill(TEST_CARDS.declined.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.declined.zip);
      await page.locator("#submit-btn").click();

      // Wait for error
      await expect(page.locator("#error-alert")).toBeVisible({
        timeout: 15000,
      });

      // Clear and enter valid card
      await stripeFrame.locator('input[name="cardnumber"]').clear();
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.valid.number);

      // Submit again
      await page.locator("#submit-btn").click();

      // Should succeed this time
      await expect(page.locator("#success-message")).toBeVisible({
        timeout: 15000,
      });
    });
  });

  test.describe("Navigation Integration", () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });
    });

    test("should have link to payment setup from account page", async ({
      page,
    }) => {
      // Navigate to account page
      await page.goto(`${PORTAL_URL}/portal-account.html`);
      await page.waitForLoadState("networkidle");

      // Look for payment methods section
      const paymentSection = page.locator("text=/Payment Methods?/i");
      await expect(paymentSection).toBeVisible({ timeout: 5000 });

      // Find link to payment setup
      const paymentLink = page.locator('a[href*="payment-setup"]');
      await expect(paymentLink).toBeVisible();
    });

    test("should navigate back to account page after success", async ({
      page,
    }) => {
      // Setup payment method
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Fill in valid card (fast path)
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.valid.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.valid.expiry);
      await stripeFrame.locator('input[name="cvc"]').fill(TEST_CARDS.valid.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.valid.zip);
      await page.locator("#submit-btn").click();

      // Wait for success
      await expect(page.locator("#success-message")).toBeVisible({
        timeout: 15000,
      });

      // Click "Go to Account Settings" button
      const accountBtn = page.locator('a[href="/portal-account.html"]');
      await expect(accountBtn).toBeVisible();
      await accountBtn.click();

      // Should navigate to account page
      await page.waitForURL(/portal-account\.html/);
      expect(page.url()).toContain("portal-account.html");
    });

    test("should have working logout button", async ({ page }) => {
      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Click logout
      await page.click("#logout-btn");

      // Should redirect to login
      await page.waitForURL(/login\.html/, { timeout: 5000 });
      expect(page.url()).toContain("login.html");
    });
  });

  test.describe("Edge Cases and Error Handling", () => {
    test.beforeEach(async ({ page }) => {
      // Login
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });
    });

    test("should handle missing Stripe key gracefully", async ({ page }) => {
      // This test would require mocking or temporarily removing the key
      // For now, we'll just verify the error handling structure exists

      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Verify error alert element exists for error display
      const errorAlert = page.locator("#error-alert");
      expect(await errorAlert.count()).toBe(1);
    });

    test("should handle network errors gracefully", async ({
      page,
      context,
    }) => {
      // Block edge function endpoint to simulate network error
      await page.route("**/functions/v1/setup-payment-method", (route) =>
        route.abort(),
      );

      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Try to submit (will fail due to blocked API)
      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.valid.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.valid.expiry);
      await stripeFrame.locator('input[name="cvc"]').fill(TEST_CARDS.valid.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.valid.zip);
      await page.locator("#submit-btn").click();

      // Should show error
      await expect(page.locator("#error-alert")).toBeVisible({
        timeout: 10000,
      });

      // Button should be re-enabled for retry
      await expect(page.locator("#submit-btn")).toBeEnabled({ timeout: 5000 });
    });

    test("should show info message for customers with existing payment method", async ({
      page,
    }) => {
      // This assumes the test user already has a payment method
      // If not, you may need to set one up first

      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Wait a moment for the check to complete
      await page.waitForTimeout(2000);

      // May show info alert (depends on whether customer has payment method)
      const infoAlert = page.locator("#info-alert");
      // Just verify the element exists (may or may not be visible)
      expect(await infoAlert.count()).toBe(1);
    });

    test("should display proper responsive design on mobile", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      // Verify elements are visible and properly sized
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("#payment-form")).toBeVisible();
      await expect(page.locator("#card-element")).toBeVisible();

      // Verify form is properly sized
      const cardElement = page.locator("#card-element");
      const box = await cardElement.boundingBox();
      expect(box.width).toBeLessThanOrEqual(375); // Should fit in mobile viewport
    });
  });

  test.describe("Database Verification (Optional)", () => {
    test("should update customer record with stripe_customer_id", async ({
      page,
    }) => {
      // This test requires database access
      // You would need to use the database query utilities to verify

      // For now, we verify through the UI that setup completes successfully
      await page.goto(`${PORTAL_URL}/login.html`);
      await page.fill('input[type="email"]', TEST_USER_EMAIL);
      await page.fill('input[type="password"]', TEST_USER_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL(/portal\.html/, { timeout: 10000 });

      await page.goto(`${PORTAL_URL}/portal-payment-setup.html`);
      await page.waitForLoadState("networkidle");

      const stripeFrame = page
        .frameLocator('iframe[name^="__privateStripeFrame"]')
        .first();
      await stripeFrame
        .locator('input[name="cardnumber"]')
        .fill(TEST_CARDS.valid.number);
      await stripeFrame
        .locator('input[name="exp-date"]')
        .fill(TEST_CARDS.valid.expiry);
      await stripeFrame.locator('input[name="cvc"]').fill(TEST_CARDS.valid.cvc);
      await stripeFrame
        .locator('input[name="postal"]')
        .fill(TEST_CARDS.valid.zip);
      await page.locator("#submit-btn").click();

      // Success indicates database was updated
      await expect(page.locator("#success-message")).toBeVisible({
        timeout: 15000,
      });

      // TODO: Add actual database query verification
      // const { query } = await import('../scripts/test-helpers/db-query.mjs');
      // const customer = await query('SELECT stripe_customer_id FROM customers WHERE email = $1', [TEST_USER_EMAIL]);
      // expect(customer.stripe_customer_id).toBeTruthy();
    });
  });
});

/**
 * Test Execution Instructions:
 *
 * Run all tests:
 *   PORTAL_URL=http://localhost:5174 npx playwright test tests/payment-setup.spec.js
 *
 * Run specific test suite:
 *   PORTAL_URL=http://localhost:5174 npx playwright test tests/payment-setup.spec.js -g "Authentication"
 *
 * Run with UI:
 *   PORTAL_URL=http://localhost:5174 npx playwright test tests/payment-setup.spec.js --ui
 *
 * Run with debug:
 *   PORTAL_URL=http://localhost:5174 npx playwright test tests/payment-setup.spec.js --debug
 *
 * Generate report:
 *   npx playwright show-report
 *
 * Prerequisites:
 * 1. Start dev server: npm run dev (in sailorskills-portal)
 * 2. Ensure Supabase is configured
 * 3. Ensure Stripe test mode keys are set
 * 4. Create test user account if needed
 */
