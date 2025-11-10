const { test, expect } = require("@playwright/test");

test("Debug Twilight Zone issue - admin login", async ({ page }) => {
  // Go to login page
  await page.goto("https://login.sailorskills.com/login.html");

  // Login with admin credentials
  await page.fill('input[type="email"]', "standardhuman@gmail.com");
  await page.fill('input[type="password"]', "KLRss!650");
  await page.click('button[type="submit"]');

  // Wait for redirect/navigation
  await page.waitForTimeout(3000);

  // Check what page we're on
  console.log("Current URL:", page.url());

  // If we're on portal, check localStorage
  if (page.url().includes("portal.sailorskills.com")) {
    const localStorage = await page.evaluate(() => {
      return {
        currentBoatId: localStorage.getItem("currentBoatId"),
        impersonatedId: sessionStorage.getItem("impersonatedCustomerId"),
        authToken: localStorage.getItem("sb-fzygakldvvzxmahkdylq-auth-token"),
      };
    });

    console.log("localStorage data:", localStorage);

    // Parse auth token to see user
    if (localStorage.authToken) {
      const session = JSON.parse(localStorage.authToken);
      console.log("User ID:", session?.user?.id);
      console.log("User email:", session?.user?.email);
    }

    // Check page content
    const pageContent = await page.textContent("body");
    console.log(
      'Page contains "Twilight Zone":',
      pageContent.includes("Twilight Zone"),
    );

    // Take screenshot
    await page.screenshot({ path: "debug-twilight-zone.png", fullPage: true });
  }
});
