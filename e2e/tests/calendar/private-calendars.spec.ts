import { test, expect } from "@playwright/test";
import { DbSeeder } from "../../utils/db-seeder";
import {
  seedPrivateCalendarScenario,
  type PrivateCalendarScenario,
} from "../../fixtures";

test.describe("Private Calendars", () => {
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

  test.describe("Non-Owner View (Security Critical)", () => {
    test.use({
      storageState: { cookies: [], origins: [] },
    });

    test.beforeEach(async ({ context }) => {
      // Set non-owner session cookie
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
    });

    test("API response contains 'Hidden' not real title", async ({ page }) => {
      // Intercept API response to verify server-side redaction
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/families/") &&
          resp.url().includes("/events") &&
          resp.request().method() === "GET"
      );

      await page.goto(`/nl/families/${scenario.family.id}/calendar`);

      const response = await responsePromise;
      const data = await response.json();

      expect(data.success).toBe(true);

      // Find the private event in response
      const privateEventInResponse = data.data.events.find(
        (e: { id: string }) => e.id === scenario.privateEvent.id
      );

      // SECURITY CHECK: Verify title is "Hidden", NOT "Secret Meeting"
      expect(privateEventInResponse).toBeDefined();
      expect(privateEventInResponse.title).toBe("Hidden");
      expect(privateEventInResponse.title).not.toBe("Secret Meeting");
      expect(privateEventInResponse.description).toBeNull();
      expect(privateEventInResponse.location).toBeNull();
      expect(privateEventInResponse.isHidden).toBe(true);

      // Public event should still show full details
      const publicEventInResponse = data.data.events.find(
        (e: { id: string }) => e.id === scenario.publicEvent.id
      );
      expect(publicEventInResponse.title).toBe("Family Dinner");
      expect(publicEventInResponse.isHidden).toBe(false);
    });

    test("DOM never contains real private event title", async ({ page }) => {
      await page.goto(`/nl/families/${scenario.family.id}/calendar`);
      await page.waitForLoadState("networkidle");

      // SECURITY CHECK: "Secret Meeting" should NEVER appear in DOM
      const pageContent = await page.content();
      expect(pageContent).not.toContain("Secret Meeting");
      expect(pageContent).not.toContain("Confidential discussion");
      expect(pageContent).not.toContain("Private Office");

      // But "Hidden" should appear
      expect(pageContent).toContain("Hidden");
    });

    test("hidden events have muted styling", async ({ page }) => {
      await page.goto(`/nl/families/${scenario.family.id}/calendar`);
      await page.waitForLoadState("networkidle");

      const hiddenEvent = page.locator('[data-hidden="true"]').first();
      await expect(hiddenEvent).toBeVisible();

      // Verify opacity is reduced (0.77 as per design)
      const opacity = await hiddenEvent.evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeLessThan(1);
      expect(parseFloat(opacity)).toBeCloseTo(0.77, 1);

      // Verify pointer-events-none
      const pointerEvents = await hiddenEvent.evaluate(
        (el) => window.getComputedStyle(el).pointerEvents
      );
      expect(pointerEvents).toBe("none");
    });
  });

  test.describe("Owner View", () => {
    test.use({
      storageState: { cookies: [], origins: [] },
    });

    test.beforeEach(async ({ context }) => {
      // Set owner session cookie
      await context.addCookies([
        {
          name: scenario.owner.sessionCookie.name,
          value: scenario.owner.sessionCookie.value,
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
    });

    test("owner sees full event details", async ({ page }) => {
      const responsePromise = page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/families/") &&
          resp.url().includes("/events") &&
          resp.request().method() === "GET"
      );

      await page.goto(`/nl/families/${scenario.family.id}/calendar`);

      const response = await responsePromise;
      const data = await response.json();

      // Owner should see full details
      const privateEventInResponse = data.data.events.find(
        (e: { id: string }) => e.id === scenario.privateEvent.id
      );

      expect(privateEventInResponse.title).toBe("Secret Meeting");
      expect(privateEventInResponse.description).toBe(
        "Confidential discussion"
      );
      expect(privateEventInResponse.location).toBe("Private Office");
      expect(privateEventInResponse.isHidden).toBe(false);
    });

    test("owner's events are interactive (not muted)", async ({ page }) => {
      await page.goto(`/nl/families/${scenario.family.id}/calendar`);
      await page.waitForLoadState("networkidle");

      // For owner, the private event should NOT have data-hidden="true"
      const privateEventElement = page.locator(
        `[data-event-id="${scenario.privateEvent.id}"]`
      );

      // If event is visible, it should be interactive
      if (await privateEventElement.isVisible()) {
        const pointerEvents = await privateEventElement.evaluate(
          (el) => window.getComputedStyle(el).pointerEvents
        );
        expect(pointerEvents).not.toBe("none");
      }
    });
  });
});
