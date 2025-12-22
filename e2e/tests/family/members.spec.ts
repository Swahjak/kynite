// e2e/tests/family/members.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Family Members", () => {
  test("should display family members on settings page", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
  }) => {
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    await page.goto("/settings");

    // Manager should be visible
    await expect(page.getByText(familyWithMembers.user.name)).toBeVisible();

    // Additional members should be visible
    for (const member of familyWithMembers.additionalMembers) {
      await expect(page.getByText(member.user.name)).toBeVisible();
    }
  });

  test("should show member roles", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
  }) => {
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    await page.goto("/settings");

    // Should show manager role for the current user
    await expect(page.getByText(/manager|beheerder/i)).toBeVisible();
  });
});
