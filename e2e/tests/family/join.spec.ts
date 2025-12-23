// e2e/tests/family/join.spec.ts
import {
  test,
  expect,
  seedAuthenticatedUser,
  seedFamilyWithInvite,
} from "../../fixtures";

test.describe("Join Family", () => {
  test("should show family name on invite page for authenticated user", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const familyScenario = await seedFamilyWithInvite(seeder);
    const joiningUser = await seedAuthenticatedUser(seeder, {
      userName: "Joining User",
      userEmail: "joining@example.com",
    });
    await applyAuth(context, [joiningUser.sessionCookie]);

    await page.goto(`/join/${familyScenario.invite.token}`);

    await expect(page.getByText(familyScenario.family.name)).toBeVisible();
  });

  test("should redirect unauthenticated user to login with callback", async ({
    page,
    seeder,
  }) => {
    const familyScenario = await seedFamilyWithInvite(seeder);

    await page.goto(`/join/${familyScenario.invite.token}`);

    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/callbackUrl.*join/);
  });

  test("should show error for expired invite", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const familyScenario = await seedFamilyWithInvite(seeder, {
      expired: true,
    });
    const joiningUser = await seedAuthenticatedUser(seeder);
    await applyAuth(context, [joiningUser.sessionCookie]);

    await page.goto(`/join/${familyScenario.invite.token}`);

    // Check for error message (use first() as there may be title + description)
    await expect(
      page.getByText(/expired|verlopen|invalid|ongeldig/i).first()
    ).toBeVisible();
  });

  test("should show error for max uses reached", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const familyScenario = await seedFamilyWithInvite(seeder, {
      maxUsesReached: true,
    });
    const joiningUser = await seedAuthenticatedUser(seeder);
    await applyAuth(context, [joiningUser.sessionCookie]);

    await page.goto(`/join/${familyScenario.invite.token}`);

    // Check for error message (use first() as there may be title + description)
    await expect(
      page.getByText(/maximum|limit|invalid|ongeldig/i).first()
    ).toBeVisible();
  });

  test("should show error for invalid invite token", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const joiningUser = await seedAuthenticatedUser(seeder);
    await applyAuth(context, [joiningUser.sessionCookie]);

    await page.goto("/join/invalid-token-12345");

    // Check for error message (use first() as there may be title + description)
    await expect(
      page.getByText(/not found|invalid|ongeldig/i).first()
    ).toBeVisible();
  });
});
