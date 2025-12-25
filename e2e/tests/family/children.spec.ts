// e2e/tests/family/children.spec.ts
import { test, expect, seedUserWithFamily } from "../../fixtures";

const ORIGIN = "http://localhost:3000";

test.describe("Child Members API", () => {
  test("manager can create a child member", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const response = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.member).toBeDefined();
    expect(data.data.member.role).toBe("child");
    expect(data.data.member.displayName).toBe("Test Child");
    expect(data.data.member.avatarColor).toBe("blue");
    expect(data.data.member.user).toBeDefined();
    expect(data.data.member.user.email).toMatch(/@placeholder\.internal$/);

    seeder.trackUser(data.data.member.userId);
  });

  test("non-manager cannot create a child member", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const participantScenario = await seedUserWithFamily(seeder, {
      userName: "Family Participant",
      role: "participant",
    });
    await applyAuth(context, [
      participantScenario.sessionCookie,
      participantScenario.familyCookie,
    ]);
    await page.goto("/");

    const response = await page.request.post(
      `/api/v1/families/${participantScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("caregiver cannot create a child member", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const caregiverScenario = await seedUserWithFamily(seeder, {
      userName: "Family Caregiver",
      role: "caregiver",
    });
    await applyAuth(context, [
      caregiverScenario.sessionCookie,
      caregiverScenario.familyCookie,
    ]);
    await page.goto("/");

    const response = await page.request.post(
      `/api/v1/families/${caregiverScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(response.status()).toBe(403);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("enforces maximum 10 children per family", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const childPromises = [];
    for (let i = 0; i < 10; i++) {
      childPromises.push(
        page.request.post(
          `/api/v1/families/${managerScenario.family.id}/children`,
          {
            data: {
              name: `Child ${i + 1}`,
              avatarColor: "blue",
            },
            headers: { Origin: ORIGIN },
          }
        )
      );
    }

    const responses = await Promise.all(childPromises);
    const successfulCreations = responses.filter((r) => r.status() === 201);
    expect(successfulCreations.length).toBe(10);

    for (const response of successfulCreations) {
      const data = await response.json();
      seeder.trackUser(data.data.member.userId);
    }

    const failedResponse = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Child 11",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(failedResponse.status()).toBe(400);
    const failedData = await failedResponse.json();
    expect(failedData.success).toBe(false);
  });

  test("manager can generate upgrade token for child", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const createResponse = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const childMemberId = createData.data.member.id;
    const childUserId = createData.data.member.userId;

    seeder.trackUser(childUserId);

    const tokenResponse = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children/${childMemberId}/upgrade-token`,
      { data: {}, headers: { Origin: ORIGIN } }
    );

    expect(tokenResponse.status()).toBe(201);
    const tokenData = await tokenResponse.json();
    expect(tokenData.success).toBe(true);
    expect(tokenData.data.token).toBeDefined();
    expect(tokenData.data.expiresAt).toBeDefined();
    expect(tokenData.data.linkUrl).toContain(
      `/link-account?token=${tokenData.data.token}`
    );
  });

  test("non-manager cannot generate upgrade token", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const createResponse = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    const createData = await createResponse.json();
    const childMemberId = createData.data.member.id;

    seeder.trackUser(createData.data.member.userId);

    const participantScenario = await seedUserWithFamily(seeder, {
      userName: "Family Participant",
      role: "participant",
    });

    const { createTestFamilyMember } =
      await import("../../utils/test-data-factory");
    const participantMembership = createTestFamilyMember(
      managerScenario.family.id,
      participantScenario.user.id,
      { role: "participant" }
    );
    await seeder.seedFamilyMember(participantMembership);

    await applyAuth(context, [
      participantScenario.sessionCookie,
      participantScenario.familyCookie,
    ]);
    await page.goto("/");

    const tokenResponse = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children/${childMemberId}/upgrade-token`,
      { data: {}, headers: { Origin: ORIGIN } }
    );

    expect(tokenResponse.status()).toBe(403);
    const tokenData = await tokenResponse.json();
    expect(tokenData.success).toBe(false);
  });

  test("manager can list children in family", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const child1Response = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Child One",
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );
    const child1Data = await child1Response.json();
    seeder.trackUser(child1Data.data.member.userId);

    const child2Response = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Child Two",
          avatarColor: "red",
        },
        headers: { Origin: ORIGIN },
      }
    );
    const child2Data = await child2Response.json();
    seeder.trackUser(child2Data.data.member.userId);

    const listResponse = await page.request.get(
      `/api/v1/families/${managerScenario.family.id}/children`
    );

    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();
    expect(listData.success).toBe(true);
    expect(listData.data.children).toHaveLength(2);
    expect(listData.data.children[0].role).toBe("child");
    expect(listData.data.children[1].role).toBe("child");
  });

  test("validates required fields when creating child", async ({
    page,
    context,
    seeder,
    applyAuth,
  }) => {
    const managerScenario = await seedUserWithFamily(seeder, {
      userName: "Family Manager",
      role: "manager",
    });
    await applyAuth(context, [
      managerScenario.sessionCookie,
      managerScenario.familyCookie,
    ]);
    await page.goto("/");

    const response1 = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          avatarColor: "blue",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(response1.status()).toBe(400);
    const data1 = await response1.json();
    expect(data1.success).toBe(false);

    const response2 = await page.request.post(
      `/api/v1/families/${managerScenario.family.id}/children`,
      {
        data: {
          name: "Test Child",
          avatarColor: "invalid-color",
        },
        headers: { Origin: ORIGIN },
      }
    );

    expect(response2.status()).toBe(400);
    const data2 = await response2.json();
    expect(data2.success).toBe(false);
  });
});
