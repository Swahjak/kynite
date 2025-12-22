// e2e/utils/test-scenarios.ts
import { DbSeeder } from "./db-seeder";
import {
  createTestUser,
  createTestSession,
  createTestFamily,
  createTestFamilyMember,
  createTestFamilyInvite,
  type TestUser,
  type TestSession,
  type TestFamily,
  type TestFamilyMember,
  type TestFamilyInvite,
} from "./test-data-factory";

export interface TestCookie {
  name: string;
  value: string;
}

export interface AuthenticatedUserScenario {
  user: TestUser;
  session: TestSession;
  sessionCookie: TestCookie;
}

export interface UserWithFamilyScenario extends AuthenticatedUserScenario {
  family: TestFamily;
  membership: TestFamilyMember;
  familyCookie: TestCookie;
}

export interface FamilyWithMembersScenario extends UserWithFamilyScenario {
  additionalMembers: Array<{
    user: TestUser;
    session: TestSession;
    membership: TestFamilyMember;
  }>;
}

export interface FamilyWithInviteScenario extends UserWithFamilyScenario {
  invite: TestFamilyInvite;
}

export async function seedAuthenticatedUser(
  seeder: DbSeeder,
  overrides?: { userName?: string; userEmail?: string }
): Promise<AuthenticatedUserScenario> {
  const user = createTestUser({
    name: overrides?.userName,
    email: overrides?.userEmail,
  });
  const session = createTestSession(user.id);

  await seeder.seedUser(user);
  await seeder.seedSession(session);

  return {
    user,
    session,
    sessionCookie: {
      name: "better-auth.session_token",
      value: session.token,
    },
  };
}

export async function seedUserWithFamily(
  seeder: DbSeeder,
  options?: {
    userName?: string;
    familyName?: string;
    role?: "manager" | "participant" | "caregiver";
  }
): Promise<UserWithFamilyScenario> {
  const authScenario = await seedAuthenticatedUser(seeder, {
    userName: options?.userName,
  });

  const family = createTestFamily({
    name: options?.familyName ?? "Test Family",
  });
  await seeder.seedFamily(family);

  const membership = createTestFamilyMember(family.id, authScenario.user.id, {
    role: options?.role ?? "manager",
  });
  await seeder.seedFamilyMember(membership);

  return {
    ...authScenario,
    family,
    membership,
    familyCookie: {
      name: "has-family",
      value: "true",
    },
  };
}

export async function seedFamilyWithMembers(
  seeder: DbSeeder,
  memberCount: number = 2
): Promise<FamilyWithMembersScenario> {
  const managerScenario = await seedUserWithFamily(seeder, {
    userName: "Family Manager",
    role: "manager",
  });

  const additionalMembers: FamilyWithMembersScenario["additionalMembers"] = [];

  for (let i = 0; i < memberCount; i++) {
    const user = createTestUser({
      name: `Family Member ${i + 1}`,
    });
    const session = createTestSession(user.id);
    await seeder.seedUser(user);
    await seeder.seedSession(session);

    const membership = createTestFamilyMember(
      managerScenario.family.id,
      user.id,
      { role: "participant" }
    );
    await seeder.seedFamilyMember(membership);

    additionalMembers.push({ user, session, membership });
  }

  return {
    ...managerScenario,
    additionalMembers,
  };
}

export async function seedFamilyWithInvite(
  seeder: DbSeeder,
  inviteOptions?: { expired?: boolean; maxUsesReached?: boolean }
): Promise<FamilyWithInviteScenario> {
  const familyScenario = await seedUserWithFamily(seeder);

  const invite = createTestFamilyInvite(
    familyScenario.family.id,
    familyScenario.user.id,
    {
      expiresAt: inviteOptions?.expired
        ? new Date(Date.now() - 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxUses: inviteOptions?.maxUsesReached ? 1 : null,
      useCount: inviteOptions?.maxUsesReached ? 1 : 0,
    }
  );
  await seeder.seedFamilyInvite(invite);

  return {
    ...familyScenario,
    invite,
  };
}
