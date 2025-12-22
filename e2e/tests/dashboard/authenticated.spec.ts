// e2e/tests/dashboard/authenticated.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Dashboard - Authenticated", () => {
  test("should display dashboard when authenticated with family", async ({
    familyPage,
  }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage).toHaveURL(/\/dashboard/);
    await expect(familyPage).not.toHaveURL(/\/login/);
  });

  test("should display greeting", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    // Greeting should be visible (time-based, so flexible match)
    await expect(
      familyPage.getByText(
        /good morning|good afternoon|good evening|goedemorgen|goedemiddag|goedenavond/i
      )
    ).toBeVisible();
  });

  test("should display weekly stars section", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage.getByTestId("weekly-stars")).toBeVisible();
  });

  test("should display active timers section", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage.getByTestId("active-timers")).toBeVisible();
  });
});
