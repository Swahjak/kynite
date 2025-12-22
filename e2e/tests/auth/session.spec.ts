// e2e/tests/auth/session.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Session Persistence", () => {
  test("should maintain session across page navigations", async ({
    familyPage,
  }) => {
    await familyPage.goto("/dashboard");
    await expect(familyPage).toHaveURL(/\/dashboard/);

    await familyPage.goto("/calendar");
    await expect(familyPage).toHaveURL(/\/calendar/);

    await familyPage.goto("/settings");
    await expect(familyPage).toHaveURL(/\/settings/);

    // Should not have redirected to login at any point
    await expect(familyPage).not.toHaveURL(/\/login/);
  });

  test("should maintain session after page reload", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");
    await expect(familyPage).toHaveURL(/\/dashboard/);

    await familyPage.reload();
    await expect(familyPage).toHaveURL(/\/dashboard/);
    await expect(familyPage).not.toHaveURL(/\/login/);
  });
});
