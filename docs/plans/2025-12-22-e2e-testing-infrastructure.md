# E2E Testing Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build comprehensive E2E testing infrastructure with database seeding, auth bypass via cookie injection, and test coverage for auth flows, family management, and dashboard features.

**Architecture:** Separate test database (PostgreSQL on port 5434) with RAM-based storage for speed. Playwright fixtures provide pre-seeded test scenarios. Auth bypass via direct DB session creation + cookie injection (no OAuth mocking).

**Tech Stack:** Playwright, Drizzle ORM, PostgreSQL, dotenv-cli, Docker Compose

---

## Phase 1: Infrastructure Setup

### Task 1: Create Test Environment File

**Files:**

- Create: `.env.test`

**Step 1: Create the environment file**

```bash
# .env.test
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/family_planner_test"
BETTER_AUTH_SECRET="test-secret-for-e2e-testing-only-32chars"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="test-client-id"
GOOGLE_CLIENT_SECRET="test-client-secret"
```

**Step 2: Add to .gitignore if not already present**

Check `.gitignore` - if `.env*` pattern exists, `.env.test` is already ignored. If not, add:

```
.env.test
```

**Step 3: Commit**

```bash
git add .env.test .gitignore
git commit -m "chore: add test environment configuration"
```

---

### Task 2: Create Docker Compose for Test Database

**Files:**

- Create: `docker-compose.test.yml`

**Step 1: Create the Docker Compose file**

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16-alpine
    container_name: family-planner-db-test
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: family_planner_test
    ports:
      - "5434:5432"
    tmpfs:
      - /var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 3s
      retries: 10
```

**Step 2: Test the container starts**

Run: `docker compose -f docker-compose.test.yml up -d --wait`
Expected: Container starts and health check passes

**Step 3: Stop the container**

Run: `docker compose -f docker-compose.test.yml down -v`

**Step 4: Commit**

```bash
git add docker-compose.test.yml
git commit -m "chore: add test database Docker Compose configuration"
```

---

### Task 3: Install dotenv-cli and Add npm Scripts

**Files:**

- Modify: `package.json`

**Step 1: Install dotenv-cli**

Run: `pnpm add -D dotenv-cli`

**Step 2: Add e2e scripts to package.json**

Add these scripts after the existing `e2e:visual:update` script:

```json
"e2e:db:up": "docker compose -f docker-compose.test.yml up -d --wait",
"e2e:db:down": "docker compose -f docker-compose.test.yml down -v",
"e2e:db:migrate": "dotenv -e .env.test -- pnpm db:push",
"e2e:setup": "pnpm e2e:db:up && pnpm e2e:db:migrate",
"e2e:teardown": "pnpm e2e:db:down",
"e2e:run": "dotenv -e .env.test -- playwright test",
"e2e:full": "pnpm e2e:setup && pnpm e2e:run; pnpm e2e:teardown"
```

**Step 3: Test the setup script**

Run: `pnpm e2e:setup`
Expected: Database container starts and migrations run successfully

**Step 4: Teardown**

Run: `pnpm e2e:teardown`

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add e2e database scripts and dotenv-cli"
```

---

## Phase 2: Database Utilities

### Task 4: Create Test Data Factory

**Files:**

- Create: `e2e/utils/test-data-factory.ts`

**Step 1: Create the utils directory**

Run: `mkdir -p e2e/utils`

**Step 2: Create the test data factory**

```typescript
// e2e/utils/test-data-factory.ts
import { randomUUID } from "crypto";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
}

export interface TestSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface TestFamily {
  id: string;
  name: string;
}

export interface TestFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: "manager" | "participant" | "caregiver";
  displayName: string | null;
  avatarColor: string | null;
}

export interface TestFamilyInvite {
  id: string;
  familyId: string;
  token: string;
  createdById: string;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
}

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
  const id = overrides.id || randomUUID();
  return {
    id,
    name: overrides.name ?? `Test User ${id.slice(0, 8)}`,
    email: overrides.email ?? `test-${id.slice(0, 8)}@example.com`,
    emailVerified: overrides.emailVerified ?? true,
    image: overrides.image ?? null,
  };
}

export function createTestSession(
  userId: string,
  overrides: Partial<TestSession> = {}
): TestSession {
  const id = overrides.id || randomUUID();
  return {
    id,
    userId,
    token: overrides.token ?? `test-session-${randomUUID()}`,
    expiresAt:
      overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };
}

export function createTestFamily(
  overrides: Partial<TestFamily> = {}
): TestFamily {
  const id = overrides.id || randomUUID();
  return {
    id,
    name: overrides.name ?? `Test Family ${id.slice(0, 8)}`,
  };
}

export function createTestFamilyMember(
  familyId: string,
  userId: string,
  overrides: Partial<Omit<TestFamilyMember, "familyId" | "userId">> = {}
): TestFamilyMember {
  return {
    id: overrides.id || randomUUID(),
    familyId,
    userId,
    role: overrides.role ?? "participant",
    displayName: overrides.displayName ?? null,
    avatarColor: overrides.avatarColor ?? null,
  };
}

export function createTestFamilyInvite(
  familyId: string,
  createdById: string,
  overrides: Partial<Omit<TestFamilyInvite, "familyId" | "createdById">> = {}
): TestFamilyInvite {
  return {
    id: overrides.id || randomUUID(),
    familyId,
    createdById,
    token: overrides.token ?? `test-invite-${randomUUID().slice(0, 16)}`,
    expiresAt:
      overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    maxUses: overrides.maxUses ?? null,
    useCount: overrides.useCount ?? 0,
  };
}
```

**Step 3: Commit**

```bash
git add e2e/utils/test-data-factory.ts
git commit -m "feat(e2e): add test data factory utilities"
```

---

### Task 5: Create Database Seeder

**Files:**

- Create: `e2e/utils/db-seeder.ts`

**Step 1: Create the database seeder**

```typescript
// e2e/utils/db-seeder.ts
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../../src/server/schema";
import type {
  TestUser,
  TestSession,
  TestFamily,
  TestFamilyMember,
  TestFamilyInvite,
} from "./test-data-factory";

export class DbSeeder {
  private client: ReturnType<typeof postgres>;
  private db: ReturnType<typeof drizzle>;
  private insertedUserIds: string[] = [];
  private insertedFamilyIds: string[] = [];
  private insertedSessionIds: string[] = [];

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    this.client = postgres(connectionString);
    this.db = drizzle(this.client, { schema });
  }

  async seedUser(user: TestUser): Promise<void> {
    await this.db.insert(schema.users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedUserIds.push(user.id);
  }

  async seedSession(session: TestSession): Promise<void> {
    await this.db.insert(schema.sessions).values({
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "Playwright Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedSessionIds.push(session.id);
  }

  async seedFamily(family: TestFamily): Promise<void> {
    await this.db.insert(schema.families).values({
      id: family.id,
      name: family.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.insertedFamilyIds.push(family.id);
  }

  async seedFamilyMember(member: TestFamilyMember): Promise<void> {
    await this.db.insert(schema.familyMembers).values({
      id: member.id,
      familyId: member.familyId,
      userId: member.userId,
      role: member.role,
      displayName: member.displayName,
      avatarColor: member.avatarColor,
      createdAt: new Date(),
    });
  }

  async seedFamilyInvite(invite: TestFamilyInvite): Promise<void> {
    await this.db.insert(schema.familyInvites).values({
      id: invite.id,
      familyId: invite.familyId,
      token: invite.token,
      createdById: invite.createdById,
      expiresAt: invite.expiresAt,
      maxUses: invite.maxUses,
      useCount: invite.useCount,
      createdAt: new Date(),
    });
  }

  async cleanup(): Promise<void> {
    // Delete in reverse order to respect FK constraints
    // Sessions, familyMembers, familyInvites cascade from users/families
    for (const sessionId of this.insertedSessionIds) {
      await this.db
        .delete(schema.sessions)
        .where(eq(schema.sessions.id, sessionId))
        .catch(() => {});
    }

    for (const familyId of this.insertedFamilyIds) {
      await this.db
        .delete(schema.families)
        .where(eq(schema.families.id, familyId))
        .catch(() => {});
    }

    for (const userId of this.insertedUserIds) {
      await this.db
        .delete(schema.users)
        .where(eq(schema.users.id, userId))
        .catch(() => {});
    }

    this.insertedUserIds = [];
    this.insertedFamilyIds = [];
    this.insertedSessionIds = [];
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
```

**Step 2: Commit**

```bash
git add e2e/utils/db-seeder.ts
git commit -m "feat(e2e): add database seeder for test data management"
```

---

### Task 6: Create Test Scenarios

**Files:**

- Create: `e2e/utils/test-scenarios.ts`

**Step 1: Create the test scenarios file**

```typescript
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
```

**Step 2: Commit**

```bash
git add e2e/utils/test-scenarios.ts
git commit -m "feat(e2e): add predefined test scenarios for common test setups"
```

---

## Phase 3: Playwright Fixtures

### Task 7: Create Auth Fixtures

**Files:**

- Create: `e2e/fixtures/auth-fixtures.ts`

**Step 1: Create the fixtures directory**

Run: `mkdir -p e2e/fixtures`

**Step 2: Create auth fixtures**

```typescript
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
```

**Step 3: Commit**

```bash
git add e2e/fixtures/auth-fixtures.ts
git commit -m "feat(e2e): add Playwright auth fixtures with database seeding"
```

---

### Task 8: Create Page Fixtures

**Files:**

- Create: `e2e/fixtures/page-fixtures.ts`

**Step 1: Create page fixtures**

```typescript
// e2e/fixtures/page-fixtures.ts
import { test as authTest } from "./auth-fixtures";

export const test = authTest.extend<{
  authenticatedPage: typeof authTest extends { page: infer P } ? P : never;
  familyPage: typeof authTest extends { page: infer P } ? P : never;
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
```

**Step 2: Commit**

```bash
git add e2e/fixtures/page-fixtures.ts
git commit -m "feat(e2e): add pre-authenticated page fixtures"
```

---

### Task 9: Create Fixtures Index

**Files:**

- Create: `e2e/fixtures/index.ts`

**Step 1: Create the index file**

```typescript
// e2e/fixtures/index.ts
export { test, expect } from "./page-fixtures";
export { test as authTest } from "./auth-fixtures";
export type {
  AuthenticatedUserScenario,
  UserWithFamilyScenario,
  FamilyWithMembersScenario,
  FamilyWithInviteScenario,
  TestCookie,
} from "../utils/test-scenarios";
export {
  seedAuthenticatedUser,
  seedUserWithFamily,
  seedFamilyWithMembers,
  seedFamilyWithInvite,
} from "../utils/test-scenarios";
```

**Step 2: Commit**

```bash
git add e2e/fixtures/index.ts
git commit -m "feat(e2e): add fixtures index for clean imports"
```

---

## Phase 4: Playwright Configuration

### Task 10: Create Global Setup

**Files:**

- Create: `e2e/global-setup.ts`

**Step 1: Create global setup**

```typescript
// e2e/global-setup.ts
import { execSync } from "child_process";

async function globalSetup() {
  if (!process.env.CI) {
    console.log("Starting test database...");
    try {
      execSync("pnpm e2e:db:up", { stdio: "inherit" });
      execSync("pnpm e2e:db:migrate", { stdio: "inherit" });
    } catch (error) {
      console.error("Failed to setup test database:", error);
      throw error;
    }
  }
}

export default globalSetup;
```

**Step 2: Commit**

```bash
git add e2e/global-setup.ts
git commit -m "feat(e2e): add global setup for test database initialization"
```

---

### Task 11: Create Global Teardown

**Files:**

- Create: `e2e/global-teardown.ts`

**Step 1: Create global teardown**

```typescript
// e2e/global-teardown.ts
import { execSync } from "child_process";

async function globalTeardown() {
  if (process.env.CI) {
    console.log("Stopping test database...");
    try {
      execSync("pnpm e2e:teardown", { stdio: "inherit" });
    } catch (error) {
      console.error("Failed to teardown test database:", error);
    }
  }
}

export default globalTeardown;
```

**Step 2: Commit**

```bash
git add e2e/global-teardown.ts
git commit -m "feat(e2e): add global teardown for CI cleanup"
```

---

### Task 12: Update Playwright Configuration

**Files:**

- Modify: `playwright.config.ts`

**Step 1: Update playwright.config.ts**

Replace the entire file with:

```typescript
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/test-results",
  snapshotDir: "./e2e/snapshots",
  snapshotPathTemplate: "{snapshotDir}/{testFilePath}/{arg}{ext}",

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { outputFolder: "./e2e/playwright-report" }],
    ["json", { outputFile: "./e2e/test-results/results.json" }],
  ],

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 100,
      threshold: 0.2,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    command: "dotenv -e .env.test -- pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  globalSetup: require.resolve("./e2e/global-setup.ts"),
  globalTeardown: require.resolve("./e2e/global-teardown.ts"),
});
```

**Step 2: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: update Playwright config for new test structure"
```

---

## Phase 5: Auth Tests

### Task 13: Create Tests Directory Structure

**Files:**

- Create: `e2e/tests/auth/` directory
- Create: `e2e/tests/family/` directory
- Create: `e2e/tests/dashboard/` directory
- Create: `e2e/tests/visual/` directory

**Step 1: Create the directory structure**

Run: `mkdir -p e2e/tests/auth e2e/tests/family e2e/tests/dashboard e2e/tests/visual`

**Step 2: Commit (no files to add yet)**

No commit needed - directories are created by adding files.

---

### Task 14: Create Auth Redirect Tests

**Files:**

- Create: `e2e/tests/auth/redirect.spec.ts`

**Step 1: Create redirect tests**

```typescript
// e2e/tests/auth/redirect.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Authentication Redirects", () => {
  test.describe("Unauthenticated Access", () => {
    test("should redirect /dashboard to /login with callbackUrl", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
      await expect(page).toHaveURL(/callbackUrl.*dashboard/);
    });

    test("should redirect /calendar to /login", async ({ page }) => {
      await page.goto("/calendar");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect /settings to /login", async ({ page }) => {
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login/);
    });

    test("should allow access to public routes without auth", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).not.toHaveURL(/\/login/);
    });

    test("should show sign in button on login page", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByText(/sign in|inloggen/i)).toBeVisible();
    });
  });

  test.describe("Authenticated Without Family", () => {
    test("should redirect /calendar to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/calendar");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });

    test("should redirect /dashboard to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/dashboard");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });

    test("should allow access to /onboarding", async ({
      authenticatedPage,
    }) => {
      await authenticatedPage.goto("/onboarding");
      await expect(authenticatedPage).toHaveURL(/\/onboarding/);
    });
  });

  test.describe("Authenticated With Family", () => {
    test("should allow access to /dashboard", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");
      await expect(familyPage).toHaveURL(/\/dashboard/);
      await expect(familyPage).not.toHaveURL(/\/login/);
    });

    test("should allow access to /calendar", async ({ familyPage }) => {
      await familyPage.goto("/calendar");
      await expect(familyPage).toHaveURL(/\/calendar/);
    });

    test("should allow access to /settings", async ({ familyPage }) => {
      await familyPage.goto("/settings");
      await expect(familyPage).toHaveURL(/\/settings/);
    });
  });
});
```

**Step 2: Run tests to verify they work**

Run: `pnpm e2e:run --project=chromium e2e/tests/auth/redirect.spec.ts`
Expected: Tests run (some may fail if routes don't exist yet - that's OK)

**Step 3: Commit**

```bash
git add e2e/tests/auth/redirect.spec.ts
git commit -m "test(e2e): add auth redirect tests"
```

---

### Task 15: Create Session Persistence Tests

**Files:**

- Create: `e2e/tests/auth/session.spec.ts`

**Step 1: Create session tests**

```typescript
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
```

**Step 2: Commit**

```bash
git add e2e/tests/auth/session.spec.ts
git commit -m "test(e2e): add session persistence tests"
```

---

## Phase 6: Family Tests

### Task 16: Create Family Join Tests

**Files:**

- Create: `e2e/tests/family/join.spec.ts`

**Step 1: Create join tests**

```typescript
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

    await expect(
      page.getByText(/expired|verlopen|invalid|ongeldig/i)
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

    await expect(
      page.getByText(/maximum|limit|invalid|ongeldig/i)
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

    await expect(page.getByText(/not found|invalid|ongeldig/i)).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/tests/family/join.spec.ts
git commit -m "test(e2e): add family join tests"
```

---

### Task 17: Create Family Members Tests

**Files:**

- Create: `e2e/tests/family/members.spec.ts`

**Step 1: Create members tests**

```typescript
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
```

**Step 2: Commit**

```bash
git add e2e/tests/family/members.spec.ts
git commit -m "test(e2e): add family members tests"
```

---

## Phase 7: Dashboard Tests

### Task 18: Create Dashboard Authenticated Tests

**Files:**

- Create: `e2e/tests/dashboard/authenticated.spec.ts`

**Step 1: Create dashboard tests**

```typescript
// e2e/tests/dashboard/authenticated.spec.ts
import { test, expect } from "../../fixtures";

test.describe("Dashboard - Authenticated", () => {
  test("should display dashboard when authenticated with family", async ({
    familyPage,
  }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage).toHaveURL(/\/dashboard/);
    await expect(familyPage).not.toHaveURL(/\/login/);
  });

  test("should display greeting", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    // Greeting should be visible (time-based, so flexible match)
    await expect(
      familyPage.getByText(
        /good morning|good afternoon|good evening|goedemorgen|goedemiddag|goedenavond/i
      )
    ).toBeVisible();
  });

  test("should display weekly stars section", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage.getByTestId("weekly-stars")).toBeVisible();
  });

  test("should display active timers section", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    await expect(familyPage.getByTestId("active-timers")).toBeVisible();
  });
});
```

**Step 2: Commit**

```bash
git add e2e/tests/dashboard/authenticated.spec.ts
git commit -m "test(e2e): add authenticated dashboard tests"
```

---

## Phase 8: Visual Tests Migration

### Task 19: Migrate Visual Tests

**Files:**

- Create: `e2e/tests/visual/visual.spec.ts`
- Delete: `e2e/visual.spec.ts` (after migration)
- Delete: `e2e/dashboard.spec.ts` (merged into auth tests)

**Step 1: Create the new visual test file**

```typescript
// e2e/tests/visual/visual.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Visual Regression", () => {
  test("homepage matches snapshot", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveScreenshot("homepage.png", {
      fullPage: true,
    });
  });

  test("login page matches snapshot", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
    });
  });
});
```

**Step 2: Delete old test files**

Run: `rm e2e/visual.spec.ts e2e/dashboard.spec.ts`

**Step 3: Move snapshots directory contents if needed**

Run: `mv e2e/snapshots/visual.spec.ts e2e/snapshots/visual/ 2>/dev/null || true`

**Step 4: Update visual test script in package.json**

In `package.json`, update the visual test scripts:

```json
"e2e:visual": "playwright test e2e/tests/visual/",
"e2e:visual:update": "playwright test e2e/tests/visual/ --update-snapshots"
```

**Step 5: Commit**

```bash
git add e2e/tests/visual/visual.spec.ts package.json
git rm e2e/visual.spec.ts e2e/dashboard.spec.ts
git commit -m "refactor(e2e): migrate visual tests to new directory structure"
```

---

## Phase 9: Add Data-Testid Attributes

### Task 20: Add Data-Testid to Weekly Stars Component

**Files:**

- Modify: `src/components/dashboard/weekly-stars/weekly-stars.tsx`

**Step 1: Find the component and add data-testid**

Add `data-testid="weekly-stars"` to the root element of the WeeklyStars component.

**Step 2: Commit**

```bash
git add src/components/dashboard/weekly-stars/weekly-stars.tsx
git commit -m "feat(dashboard): add data-testid to weekly stars component"
```

---

### Task 21: Add Data-Testid to Active Timers Component

**Files:**

- Modify: `src/components/dashboard/active-timers/active-timers.tsx`

**Step 1: Find the component and add data-testid**

Add `data-testid="active-timers"` to the root element of the ActiveTimers component.

**Step 2: Commit**

```bash
git add src/components/dashboard/active-timers/active-timers.tsx
git commit -m "feat(dashboard): add data-testid to active timers component"
```

---

## Phase 10: CI/CD Integration

### Task 22: Create GitHub Actions Workflow

**Files:**

- Create: `.github/workflows/e2e.yml`

**Step 1: Create the workflow directory**

Run: `mkdir -p .github/workflows`

**Step 2: Create the workflow file**

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: family_planner_test
        ports:
          - 5434:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run database migrations
        run: pnpm e2e:db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5434/family_planner_test

      - name: Run E2E tests
        run: pnpm e2e:run
        env:
          CI: true
          DATABASE_URL: postgresql://postgres:postgres@localhost:5434/family_planner_test
          BETTER_AUTH_SECRET: test-secret-for-e2e-testing-only-32chars
          BETTER_AUTH_URL: http://localhost:3000
          NEXT_PUBLIC_BETTER_AUTH_URL: http://localhost:3000
          GOOGLE_CLIENT_ID: test-client-id
          GOOGLE_CLIENT_SECRET: test-client-secret

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: e2e/playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-artifacts
          path: |
            e2e/test-results/
            e2e/snapshots/
          retention-days: 7
```

**Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "ci: add GitHub Actions workflow for E2E tests"
```

---

## Phase 11: Final Verification

### Task 23: Run Full E2E Test Suite

**Step 1: Setup and run tests**

Run: `pnpm e2e:full`

Expected: All tests run (some may need UI adjustments for data-testid attributes)

**Step 2: Fix any failing tests**

If tests fail due to missing data-testid or UI changes, update the relevant components.

**Step 3: Update visual snapshots if needed**

Run: `pnpm e2e:visual:update`

**Step 4: Final commit**

```bash
git add -A
git commit -m "test(e2e): complete E2E testing infrastructure setup"
```

---

## Summary

This plan creates a comprehensive E2E testing infrastructure with:

1. **Separate test database** - PostgreSQL on port 5434 with RAM storage
2. **Database seeding** - Factory functions and scenario helpers
3. **Auth bypass** - Cookie injection via Playwright fixtures
4. **Test coverage** - Auth flows, family management, dashboard
5. **CI/CD** - GitHub Actions workflow with PostgreSQL service

**Total tasks:** 23
**Estimated time:** 3-4 hours

---

Plan complete and saved to `docs/plans/2025-12-22-e2e-testing-infrastructure.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
