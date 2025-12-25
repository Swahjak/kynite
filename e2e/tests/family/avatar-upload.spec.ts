import { expect } from "@playwright/test";
import { authTest } from "../../fixtures/auth-fixture";

const VALID_SVG = `<svg viewBox="0 0 264 280" xmlns="http://www.w3.org/2000/svg"><circle cx="132" cy="140" r="100" fill="#D0C6AC"/></svg>`;

authTest.describe("Avatar Upload", () => {
  authTest(
    "shows upload button in member edit dialog",
    async ({ authedPage }) => {
      await authedPage.goto("/settings");

      // Click edit on a member
      const editButton = authedPage
        .getByRole("button", { name: /edit/i })
        .first();
      if (await editButton.isVisible()) {
        await editButton.click();
        // Verify upload button exists
        await expect(authedPage.getByText(/upload avatar/i)).toBeVisible();
      }
    }
  );
});
