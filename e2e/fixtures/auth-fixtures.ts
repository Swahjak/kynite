// e2e/fixtures/auth-fixtures.ts
import { test as base, type BrowserContext } from "@playwright/test";
import { DbSeeder } from "../utils/db-seeder";
import {
  seedAuthenticatedUser,
  seedUserWithFamily,
  seedFamilyWithMembers,
  seedFamilyWithInvite,
  type AuthenticatedUserScenario,
  type UserWithFamilyScenario,
  type FamilyWithMembersScenario,
  type FamilyWithInviteScenario,
  type TestCookie,
} from "../utils/test-scenarios";

type AuthFixtures = {
  seeder: DbSeeder;
  authenticatedUser: AuthenticatedUserScenario;
  userWithFamily: UserWithFamilyScenario;
  familyWithMembers: FamilyWithMembersScenario;
  familyWithInvite: FamilyWithInviteScenario;
  applyAuth: (context: BrowserContext, cookies: TestCookie[]) => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  seeder: async ({}, use) => {
    const seeder = new DbSeeder();
    await use(seeder);
    await seeder.cleanup();
    await seeder.close();
  },

  authenticatedUser: async ({ seeder }, use) => {
    const scenario = await seedAuthenticatedUser(seeder);
    await use(scenario);
  },

  userWithFamily: async ({ seeder }, use) => {
    const scenario = await seedUserWithFamily(seeder);
    await use(scenario);
  },

  familyWithMembers: async ({ seeder }, use) => {
    const scenario = await seedFamilyWithMembers(seeder, 3);
    await use(scenario);
  },

  familyWithInvite: async ({ seeder }, use) => {
    const scenario = await seedFamilyWithInvite(seeder);
    await use(scenario);
  },

  applyAuth: async ({}, use) => {
    const applyAuth = async (
      context: BrowserContext,
      cookies: TestCookie[]
    ) => {
      await context.addCookies(
        cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax" as const,
        }))
      );
    };
    await use(applyAuth);
  },
});

export { expect } from "@playwright/test";
