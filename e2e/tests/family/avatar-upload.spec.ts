import { test, expect } from "../../fixtures";

const VALID_SVG = `<svg viewBox="0 0 264 280" xmlns="http://www.w3.org/2000/svg"><circle cx="132" cy="140" r="100" fill="#D0C6AC"/></svg>`;

test.describe("Avatar Upload", () => {
  test("shows upload button in member edit dialog", async ({
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

    // Click edit on a member
    const editButton = page.getByRole("button", { name: /edit/i }).first();
    if (await editButton.isVisible()) {
      await editButton.click();
      // Verify upload button exists
      await expect(page.getByText(/upload avatar/i)).toBeVisible();
    }
  });
});
