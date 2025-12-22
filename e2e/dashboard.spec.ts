import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.describe("Unauthenticated", () => {
    test("redirects to login when not authenticated", async ({ page }) => {
      await page.goto("/dashboard");
      // Should redirect to login page
      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText(/sign in|inloggen/i)).toBeVisible();
    });

    test("preserves callback URL for redirect after login", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      // Should include callback URL in redirect
      await expect(page).toHaveURL(/callbackUrl.*dashboard/);
    });
  });

  // TODO: Add authenticated tests with proper auth setup
  // These tests require:
  // 1. Setting up storageState with valid session
  // 2. Having a test user with family membership
  // Example:
  // test.describe("Authenticated", () => {
  //   test.use({ storageState: ".auth/user.json" });
  //   test("displays greeting and clock", async ({ page }) => { ... });
  // });
});
