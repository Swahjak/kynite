// e2e/tests/visual/visual.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Visual Regression", () => {
  test("homepage matches snapshot", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
    });
  });

  test("login page matches snapshot", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
    });
  });
});
