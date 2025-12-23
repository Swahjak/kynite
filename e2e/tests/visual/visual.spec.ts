// e2e/tests/visual/visual.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Visual Regression", () => {
  test("homepage matches snapshot", async ({ page }) => {
    await page.goto("/");
    // Wait for page to be fully loaded and stable
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
      // Hide unstable elements like dev tools buttons
      mask: [page.locator('button[aria-label*="Next.js"]')],
      // Increase tolerance for minor differences
      maxDiffPixels: 1000,
    });
  });

  test("login page matches snapshot", async ({ page }) => {
    await page.goto("/login");
    // Wait for page to be fully loaded and stable
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
      mask: [page.locator('button[aria-label*="Next.js"]')],
      maxDiffPixels: 1000,
    });
  });
});
