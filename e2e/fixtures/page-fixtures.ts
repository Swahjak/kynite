// e2e/fixtures/page-fixtures.ts
import { test as authTest } from "./auth-fixtures";
import type { Page } from "@playwright/test";

export const test = authTest.extend<{
  authenticatedPage: Page;
  familyPage: Page;
}>({
  authenticatedPage: async (
    { page, context, authenticatedUser, applyAuth },
    use
  ) => {
    await applyAuth(context, [authenticatedUser.sessionCookie]);
    await use(page);
  },

  familyPage: async ({ page, context, userWithFamily, applyAuth }, use) => {
    await applyAuth(context, [
      userWithFamily.sessionCookie,
      userWithFamily.familyCookie,
    ]);
    await use(page);
  },
});

export { expect } from "@playwright/test";
