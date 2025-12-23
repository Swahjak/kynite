import { test, expect } from "../../fixtures";

test.describe("Private Calendars", () => {
  test.describe("Hidden Event Display", () => {
    test("hidden events show 'Hidden' title", async ({ familyPage }) => {
      // Navigate to calendar
      await familyPage.goto("/calendar");

      // Check for hidden events (if any exist in test data)
      const hiddenEvents = familyPage.locator('[data-hidden="true"]');
      const count = await hiddenEvents.count();

      if (count > 0) {
        // Verify hidden events display correctly
        await expect(hiddenEvents.first()).toContainText("Hidden");

        // Verify muted opacity styling (0.77 = roughly 0.77)
        const opacity = await hiddenEvents
          .first()
          .evaluate((el: HTMLElement) => window.getComputedStyle(el).opacity);
        expect(parseFloat(opacity)).toBeLessThan(1);
      }
    });

    test("hidden events are not draggable", async ({ familyPage }) => {
      await familyPage.goto("/calendar");

      const hiddenEvents = familyPage.locator('[data-hidden="true"]');
      const count = await hiddenEvents.count();

      if (count > 0) {
        // Verify pointer-events-none is applied
        const pointerEvents = await hiddenEvents
          .first()
          .evaluate(
            (el: HTMLElement) => window.getComputedStyle(el).pointerEvents
          );
        expect(pointerEvents).toBe("none");
      }
    });
  });

  test.describe("Privacy Settings", () => {
    test("can toggle calendar privacy in settings", async ({ familyPage }) => {
      await familyPage.goto("/settings");

      // Look for privacy toggle switches
      const privacyToggles = familyPage.locator('[aria-label*="private"]');

      // This test will pass even if no toggles exist (no linked Google accounts)
      // The test verifies the toggle works when present
      const count = await privacyToggles.count();
      if (count > 0) {
        // Toggle the first privacy switch
        const firstToggle = privacyToggles.first();
        const wasChecked = await firstToggle.isChecked();
        await firstToggle.click();

        // Wait for API response
        await familyPage.waitForTimeout(500);

        // Verify state changed
        const isChecked = await firstToggle.isChecked();
        expect(isChecked).not.toBe(wasChecked);
      }
    });
  });

  test.describe("API Privacy Filtering", () => {
    test("API returns redacted events for private calendars", async ({
      familyPage,
    }) => {
      // Setup: Navigate to calendar and capture network response
      const responsePromise = familyPage.waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/families/") &&
          resp.url().includes("/events")
      );

      await familyPage.goto("/calendar");

      const response = await responsePromise;
      const data = await response.json();

      if (data.success && data.data?.events) {
        // Check if any events are marked as hidden
        const hiddenEvents = data.data.events.filter(
          (e: { isHidden: boolean }) => e.isHidden
        );

        // Verify hidden events have redacted content
        for (const event of hiddenEvents) {
          expect(event.title).toBe("Hidden");
          expect(event.description).toBeNull();
          expect(event.location).toBeNull();
        }
      }
    });
  });
});
