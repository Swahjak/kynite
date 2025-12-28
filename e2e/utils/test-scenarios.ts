// e2e/utils/test-scenarios.ts
import { DbSeeder } from "./db-seeder";
import {
  createTestFamily,
  createTestFamilyMember,
  createTestFamilyInvite,
  createTestAccount,
  createTestGoogleCalendar,
  createTestEvent,
  type TestUser,
  type TestSession,
  type TestFamily,
  type TestFamilyMember,
  type TestFamilyInvite,
  type TestAccount,
  type TestGoogleCalendar,
  type TestEvent,
} from "./test-data-factory";
import { randomUUID } from "crypto";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

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

export interface PrivateCalendarScenario {
  owner: {
    user: TestUser;
    session: TestSession;
    sessionCookie: TestCookie;
    membership: TestFamilyMember;
    account: TestAccount;
  };
  nonOwner: {
    user: TestUser;
    session: TestSession;
    sessionCookie: TestCookie;
    membership: TestFamilyMember;
  };
  family: TestFamily;
  calendar: TestGoogleCalendar;
  privateEvent: TestEvent;
  publicEvent: TestEvent;
  familyCookie: TestCookie;
}

/**
 * Parse Set-Cookie header to extract cookie name and value
 */
function parseSetCookie(
  setCookieHeader: string | null
): Map<string, { value: string; attributes: string }> {
  const cookies = new Map<string, { value: string; attributes: string }>();
  if (!setCookieHeader) return cookies;

  // Handle multiple cookies (they may be joined with comma, but we need to be careful)
  const cookieStrings = setCookieHeader.split(/,(?=[^;]*=)/);

  for (const cookieStr of cookieStrings) {
    const parts = cookieStr.trim().split(";");
    const nameValue = parts[0];
    const [name, ...valueParts] = nameValue.split("=");
    const value = valueParts.join("="); // Handle values with = in them
    cookies.set(name.trim(), {
      value: value.trim(),
      attributes: parts.slice(1).join(";"),
    });
  }

  return cookies;
}

/**
 * Create a test user with a signed session via our test API
 */
async function createTestSession(
  email: string,
  name: string
): Promise<{ sessionCookie: TestCookie; userId: string }> {
  const response = await fetch(`${BASE_URL}/api/test/create-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, name }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Failed to create test session: ${response.status} - ${error}`
    );
  }

  const setCookieHeader = response.headers.get("set-cookie");
  const cookies = parseSetCookie(setCookieHeader);

  // Look for session token cookie
  const sessionCookie =
    cookies.get("better-auth.session_token") ||
    cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    throw new Error(
      `No session cookie in response. Headers: ${JSON.stringify(Object.fromEntries(response.headers))}`
    );
  }

  const data = await response.json();

  return {
    sessionCookie: {
      name: cookies.has("__Secure-better-auth.session_token")
        ? "__Secure-better-auth.session_token"
        : "better-auth.session_token",
      value: sessionCookie.value,
    },
    userId: data.user?.id,
  };
}

export async function seedAuthenticatedUser(
  seeder: DbSeeder,
  overrides?: { userName?: string; userEmail?: string }
): Promise<AuthenticatedUserScenario> {
  const id = randomUUID();
  const email = overrides?.userEmail ?? `test-${id.slice(0, 8)}@example.com`;
  const name = overrides?.userName ?? `Test User ${id.slice(0, 8)}`;

  // Create session via our test API
  const { sessionCookie, userId } = await createTestSession(email, name);

  // Create a TestUser object that matches the created user
  const user: TestUser = {
    id: userId,
    name,
    email,
    emailVerified: true,
    image: null,
  };

  // Create a placeholder session (the real session is managed by better-auth)
  const session: TestSession = {
    id: randomUUID(),
    userId,
    token: sessionCookie.value,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  // Track the user for cleanup
  seeder.trackUser(userId);

  return {
    user,
    session,
    sessionCookie,
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
    // Create additional members via test API
    const id = randomUUID();
    const email = `member-${id.slice(0, 8)}@example.com`;
    const name = `Family Member ${i + 1}`;

    const { sessionCookie, userId } = await createTestSession(email, name);

    const user: TestUser = {
      id: userId,
      name,
      email,
      emailVerified: true,
      image: null,
    };

    const session: TestSession = {
      id: randomUUID(),
      userId,
      token: sessionCookie.value,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    seeder.trackUser(userId);

    const membership = createTestFamilyMember(
      managerScenario.family.id,
      userId,
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

export async function seedPrivateCalendarScenario(
  seeder: DbSeeder
): Promise<PrivateCalendarScenario> {
  // Create family
  const family = createTestFamily({ name: "Privacy Test Family" });
  await seeder.seedFamily(family);

  // Create owner (User A) with Google account
  const ownerAuth = await seedAuthenticatedUser(seeder, {
    userName: "Calendar Owner",
    userEmail: "owner@example.com",
  });

  const ownerMembership = createTestFamilyMember(family.id, ownerAuth.user.id, {
    role: "manager",
    displayName: "Calendar Owner",
  });
  await seeder.seedFamilyMember(ownerMembership);

  // Create Google account for owner
  const account = createTestAccount(ownerAuth.user.id);
  await seeder.seedAccount(account);

  // Create private calendar
  const calendar = createTestGoogleCalendar(family.id, account.id, {
    name: "Private Work Calendar",
    isPrivate: true,
  });
  await seeder.seedGoogleCalendar(calendar);

  // Create event on private calendar (should be hidden from non-owner)
  const now = new Date();
  const privateEvent = createTestEvent(family.id, {
    title: "Secret Meeting",
    description: "Confidential discussion",
    location: "Private Office",
    startTime: now,
    endTime: new Date(now.getTime() + 60 * 60 * 1000),
    googleCalendarId: calendar.id,
    googleEventId: `private-event-${randomUUID().slice(0, 8)}`,
  });
  await seeder.seedEvent(privateEvent);

  // Create non-owner (User B) in same family
  const nonOwnerAuth = await seedAuthenticatedUser(seeder, {
    userName: "Family Member",
    userEmail: "member@example.com",
  });

  const nonOwnerMembership = createTestFamilyMember(
    family.id,
    nonOwnerAuth.user.id,
    {
      role: "participant",
      displayName: "Family Member",
    }
  );
  await seeder.seedFamilyMember(nonOwnerMembership);

  // Create a public calendar for comparison
  const publicCalendar = createTestGoogleCalendar(family.id, account.id, {
    name: "Public Family Calendar",
    isPrivate: false,
  });
  await seeder.seedGoogleCalendar(publicCalendar);

  // Create public event (visible to everyone)
  const publicEvent = createTestEvent(family.id, {
    title: "Family Dinner",
    description: "Weekly family dinner",
    location: "Home",
    startTime: now,
    endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    googleCalendarId: publicCalendar.id,
    googleEventId: `public-event-${randomUUID().slice(0, 8)}`,
  });
  await seeder.seedEvent(publicEvent);

  return {
    owner: {
      user: ownerAuth.user,
      session: ownerAuth.session,
      sessionCookie: ownerAuth.sessionCookie,
      membership: ownerMembership,
      account,
    },
    nonOwner: {
      user: nonOwnerAuth.user,
      session: nonOwnerAuth.session,
      sessionCookie: nonOwnerAuth.sessionCookie,
      membership: nonOwnerMembership,
    },
    family,
    calendar,
    privateEvent,
    publicEvent,
    familyCookie: { name: "has-family", value: "true" },
  };
}
