// e2e/tests/visual/visual.spec.ts
import { test, expect } from "@playwright/test";
import { DbSeeder } from "../../utils/db-seeder";
import {
  seedPrivateCalendarScenario,
  type PrivateCalendarScenario,
} from "../../fixtures";

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

test.describe("Private Calendar Visual Regression", () => {
  let seeder: DbSeeder;
  let scenario: PrivateCalendarScenario;

  test.beforeAll(async () => {
    seeder = new DbSeeder();
    scenario = await seedPrivateCalendarScenario(seeder);
  });

  test.afterAll(async () => {
    await seeder.cleanup();
    await seeder.close();
  });

  test("hidden events have muted styling", async ({ page, context }) => {
    // Set non-owner session
    await context.addCookies([
      {
        name: scenario.nonOwner.sessionCookie.name,
        value: scenario.nonOwner.sessionCookie.value,
        domain: "localhost",
        path: "/",
      },
      {
        name: scenario.familyCookie.name,
        value: scenario.familyCookie.value,
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.goto(`/nl/families/${scenario.family.id}/calendar`);
    await page.waitForLoadState("networkidle");

    // Wait for events to render
    await page.waitForSelector('[data-hidden="true"]', { timeout: 5000 });

    // Screenshot the hidden event for visual regression
    const hiddenEvent = page.locator('[data-hidden="true"]').first();
    await expect(hiddenEvent).toHaveScreenshot("hidden-event-muted.png", {
      maxDiffPixels: 100,
    });
  });
});
