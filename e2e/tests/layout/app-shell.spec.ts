import { test, expect } from "../../fixtures";

test.describe("App Shell", () => {
  test("should show header on all app routes", async ({ familyPage }) => {
    const routes = ["/dashboard", "/calendar", "/settings/accounts"];

    for (const route of routes) {
      await familyPage.goto(route);
      await expect(familyPage.locator("header")).toBeVisible();
    }
  });

  test("should open navigation menu when clicking menu button", async ({
    familyPage,
  }) => {
    await familyPage.goto("/dashboard");

    await familyPage.getByLabel("Open menu").click();

    // Navigation sheet should be visible
    await expect(familyPage.getByRole("navigation")).toBeVisible();
    await expect(
      familyPage.getByRole("link", { name: /dashboard/i })
    ).toBeVisible();
    await expect(
      familyPage.getByRole("link", { name: /calendar/i })
    ).toBeVisible();
  });

  test("should navigate between routes via menu", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    // Open menu and click calendar
    await familyPage.getByLabel("Open menu").click();
    await familyPage.getByRole("link", { name: /calendar/i }).click();

    await expect(familyPage).toHaveURL(/\/calendar/);
  });
});
