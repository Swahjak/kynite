import { test, expect } from "../../fixtures";

test.describe("Mode Toggle", () => {
  test.describe("as manager", () => {
    test("should show mode toggle button", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");
      await expect(familyPage.getByLabel(/switch to/i)).toBeVisible();
    });

    test("should toggle between manage and wall mode", async ({
      familyPage,
    }) => {
      await familyPage.goto("/dashboard");

      // Start in manage mode - user menu should be visible
      await expect(familyPage.getByTestId("user-avatar")).toBeVisible();

      // Toggle to wall mode
      await familyPage.getByLabel(/switch to wall/i).click();

      // In wall mode - user menu should be hidden
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();

      // Toggle back to manage mode
      await familyPage.getByLabel(/switch to manage/i).click();

      // User menu should be visible again
      await expect(familyPage.getByTestId("user-avatar")).toBeVisible();
    });

    test("should persist mode across page refresh", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");

      // Toggle to wall mode
      await familyPage.getByLabel(/switch to wall/i).click();
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();

      // Refresh page
      await familyPage.reload();

      // Should still be in wall mode
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();
    });
  });

  test.describe("as participant", () => {
    // Note: Need to add participant fixture or modify family fixture
    test.skip("should not show mode toggle button", async () => {
      // TODO: Implement when participant fixture is available
    });
  });
});
