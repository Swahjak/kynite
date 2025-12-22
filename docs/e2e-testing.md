# E2E Testing Infrastructure

This document describes the E2E testing setup for Family Planner using Playwright with database seeding and auth bypass.

## Quick Start

```bash
# Full test cycle (recommended)
pnpm e2e:full

# Or step by step:
pnpm e2e:setup        # Start test DB + migrations
pnpm e2e:run          # Run tests
pnpm e2e:teardown     # Cleanup
```

## Architecture

### Test Database

- **Separate PostgreSQL instance** on port 5434 (vs 5432 for dev)
- **RAM-based storage** (tmpfs) for speed - data is ephemeral
- **Docker Compose** manages the container (`docker-compose.test.yml`)

```bash
pnpm e2e:db:up        # Start container
pnpm e2e:db:down      # Stop and remove
pnpm e2e:db:migrate   # Apply schema
```

### Auth Bypass

Tests bypass OAuth by:

1. Seeding users/sessions directly into the test database
2. Injecting session cookies via Playwright's `context.addCookies()`

No mocking required - tests use real auth validation against test data.

## Directory Structure

```
e2e/
├── fixtures/           # Playwright test fixtures
│   ├── auth-fixtures.ts    # DB seeding + cookie injection
│   ├── page-fixtures.ts    # Pre-authenticated pages
│   └── index.ts            # Re-exports
├── utils/              # Test utilities
│   ├── test-data-factory.ts  # Create test entities
│   ├── db-seeder.ts          # Insert/cleanup test data
│   └── test-scenarios.ts     # Predefined test setups
├── tests/              # Test specs
│   ├── auth/           # Authentication tests
│   ├── family/         # Family management tests
│   ├── dashboard/      # Dashboard feature tests
│   └── visual/         # Visual regression tests
├── snapshots/          # Visual regression baselines
├── global-setup.ts     # Start DB before tests
└── global-teardown.ts  # Cleanup in CI
```

## Writing Tests

### Using Fixtures

Import from the fixtures index for clean syntax:

```typescript
import { test, expect } from "../../fixtures";

test.describe("My Feature", () => {
  // Use pre-authenticated page with family
  test("should work for family member", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");
    await expect(familyPage).toHaveURL(/dashboard/);
  });

  // Use authenticated page without family
  test("should redirect to onboarding", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/dashboard");
    await expect(authenticatedPage).toHaveURL(/onboarding/);
  });
});
```

### Available Fixtures

| Fixture             | Description                             |
| ------------------- | --------------------------------------- |
| `seeder`            | Direct DB access for custom seeding     |
| `authenticatedUser` | User with session, no family            |
| `userWithFamily`    | User with session and family membership |
| `familyWithMembers` | Family with manager + 3 participants    |
| `familyWithInvite`  | Family with active invite link          |
| `applyAuth`         | Helper to inject cookies into context   |
| `authenticatedPage` | Page with session cookie applied        |
| `familyPage`        | Page with session + family cookies      |

### Custom Scenarios

For complex setups, use the seeder directly:

```typescript
import {
  test,
  expect,
  seedAuthenticatedUser,
  seedFamilyWithInvite,
} from "../../fixtures";

test("custom scenario", async ({ page, context, seeder, applyAuth }) => {
  // Create family with invite
  const family = await seedFamilyWithInvite(seeder);

  // Create separate user to join
  const joiner = await seedAuthenticatedUser(seeder, {
    userName: "New Member",
    userEmail: "new@example.com",
  });

  // Apply auth for the joining user
  await applyAuth(context, [joiner.sessionCookie]);

  // Test the join flow
  await page.goto(`/join/${family.invite.token}`);
  await expect(page.getByText(family.family.name)).toBeVisible();
});
```

## Test Data Factory

Create test entities with sensible defaults:

```typescript
import {
  createTestUser,
  createTestSession,
  createTestFamily,
  createTestFamilyMember,
  createTestFamilyInvite,
} from "../utils/test-data-factory";

// All fields have defaults, override as needed
const user = createTestUser({ name: "Custom Name" });
const session = createTestSession(user.id);
const family = createTestFamily({ name: "Smith Family" });
const member = createTestFamilyMember(family.id, user.id, { role: "manager" });
```

## Database Seeder

The `DbSeeder` class handles insertion and cleanup:

```typescript
const seeder = new DbSeeder();

// Seed data
await seeder.seedUser(user);
await seeder.seedSession(session);
await seeder.seedFamily(family);
await seeder.seedFamilyMember(member);

// Automatic cleanup tracks inserted IDs
await seeder.cleanup(); // Deletes in correct order (FK constraints)
await seeder.close(); // Close DB connection
```

## Visual Regression Tests

Located in `e2e/tests/visual/`:

```typescript
import { test, expect } from "@playwright/test";

test("homepage matches snapshot", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveScreenshot("homepage.png", { fullPage: true });
});
```

Update baselines after intentional UI changes:

```bash
pnpm e2e:visual:update
```

## CI/CD

GitHub Actions workflow (`.github/workflows/e2e.yml`):

- Triggers on push to main/develop and PRs to main
- Uses PostgreSQL service container
- Installs only chromium browser for speed
- Uploads HTML report and failure artifacts

## Environment

Test environment (`.env.test`):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/family_planner_test
BETTER_AUTH_SECRET=test-secret-for-e2e-testing-only-32chars
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=test-client-id
GOOGLE_CLIENT_SECRET=test-client-secret
```

## Troubleshooting

### Tests hang on migrations

The `drizzle-kit push` command prompts for confirmation. Use `--force` flag or pipe `echo "y"`:

```bash
echo "y" | pnpm e2e:db:migrate
```

### Database connection errors

Ensure the test container is running:

```bash
docker ps | grep family-planner-db-test
pnpm e2e:db:up  # Start if not running
```

### Visual test failures

Snapshots are viewport-dependent. Update after intentional changes:

```bash
pnpm e2e:visual:update
```

### Pre-commit hooks block commits

Test files may trigger the visual test suite. Use `--no-verify` for test infrastructure changes:

```bash
git commit --no-verify -m "test(e2e): update test infrastructure"
```
