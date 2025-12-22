// e2e/tests/auth/redirect.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Authentication Redirects", () => {
  test.describe("Unauthenticated Access", () => {
    test("should redirect /dashboard to /login with callbackUrl", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
      await expect(page).toHaveURL(/callbackUrl.*dashboard/);
    });

    test("should redirect /calendar to /login", async ({ page }) => {
      await page.goto("/calendar");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect /settings to /login", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should allow access to public routes without auth", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).not.toHaveURL(/\/login/);
    });

    test("should show sign in button on login page", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByText(/sign in|inloggen/i)).toBeVisible();
    });
  });

  test.describe("Authenticated Without Family", () => {
    test("should redirect /calendar to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/calendar");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });

    test("should redirect /dashboard to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/dashboard");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });

    test("should allow access to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/onboarding");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });
  });

  test.describe("Authenticated With Family", () => {
    test("should allow access to /dashboard", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");
      await expect(familyPage).toHaveURL(/\/dashboard/);
      await expect(familyPage).not.toHaveURL(/\/login/);
    });

    test("should allow access to /calendar", async ({ familyPage }) => {
      await familyPage.goto("/calendar");
      await expect(familyPage).toHaveURL(/\/calendar/);
    });

    test("should allow access to /settings", async ({ familyPage }) => {
      await familyPage.goto("/settings");
      await expect(familyPage).toHaveURL(/\/settings/);
    });
  });
});
