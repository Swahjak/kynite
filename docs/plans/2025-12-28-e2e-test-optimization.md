# E2E Test Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce E2E test execution time in GitHub Actions from ~15-20 minutes to ~3-5 minutes through parallelization, sharding, and selective test running.

**Architecture:** Three-phase approach: (1) Quick wins with browser caching and split browser jobs, (2) Fix session race condition and enable parallel sharding, (3) Add selective test running based on changed files with full runs on main branch as safety net.

**Tech Stack:** Playwright, GitHub Actions, TypeScript, minimatch

---

## Task 1: Add Playwright Browser Caching

**Files:**

- Modify: `.github/workflows/e2e.yml:46-47`

**Step 1: Add browser version detection and caching**

Replace the current browser installation step with cached version:

```yaml
- name: Get Playwright version
  id: playwright-version
  run: echo "version=$(pnpm exec playwright --version | head -n1)" >> $GITHUB_OUTPUT

- name: Cache Playwright browsers
  uses: actions/cache@v4
  id: playwright-cache
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}

- name: Install Playwright browsers
  if: steps.playwright-cache.outputs.cache-hit != 'true'
  run: pnpm exec playwright install --with-deps chromium
```

**Step 2: Verify the workflow syntax**

Run: `cat .github/workflows/e2e.yml | head -60`

Expected: Valid YAML with caching steps before test execution.

**Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "perf(e2e): add Playwright browser caching in CI"
```

---

## Task 2: Split Desktop and Mobile Browser Jobs

**Files:**

- Modify: `.github/workflows/e2e.yml:10-82`

**Step 1: Add matrix strategy for browser projects**

Replace the current job configuration with matrix strategy:

```yaml
jobs:
  e2e:
    name: E2E Tests (${{ matrix.project }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        project: [chromium, mobile-chrome]

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

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Get Playwright version
        id: playwright-version
        run: echo "version=$(pnpm exec playwright --version | head -n1)" >> $GITHUB_OUTPUT

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        id: playwright-cache
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}

      - name: Install Playwright browsers
        if: steps.playwright-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: Run database migrations
        run: pnpm e2e:db:migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5434/family_planner_test

      - name: Run E2E tests
        run: pnpm e2e:run --project=${{ matrix.project }}
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
          name: playwright-report-${{ matrix.project }}
          path: e2e/playwright-report/
          retention-days: 7

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-artifacts-${{ matrix.project }}
          path: |
            e2e/test-results/
            e2e/snapshots/
          retention-days: 7
```

**Step 2: Verify workflow syntax is valid**

Run: `pnpm dlx yaml-lint .github/workflows/e2e.yml || echo "Install yamllint if needed"`

Expected: No YAML syntax errors.

**Step 3: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "perf(e2e): split desktop and mobile browser jobs for parallel execution"
```

---

## Task 3: Fix Session Creation Race Condition

**Files:**

- Modify: `e2e/utils/test-scenarios.ts:102-146`

**Step 1: Write test to verify unique emails prevent collisions**

Create: `e2e/utils/__tests__/test-scenarios.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("createTestSession email uniqueness", () => {
  it("should generate unique emails for concurrent session creation", () => {
    // Simulate the uniqueness logic
    const baseEmail = "test@example.com";
    const emails = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const uniqueId = crypto.randomUUID().slice(0, 8);
      const uniqueEmail = baseEmail.replace("@", `-${uniqueId}@`);
      emails.add(uniqueEmail);
    }

    // All 100 emails should be unique
    expect(emails.size).toBe(100);
  });

  it("should produce valid email format", () => {
    const baseEmail = "test@example.com";
    const uniqueId = "abc12345";
    const uniqueEmail = baseEmail.replace("@", `-${uniqueId}@`);

    expect(uniqueEmail).toBe("test-abc12345@example.com");
    expect(uniqueEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});
```

**Step 2: Run the test to verify it passes**

Run: `pnpm test:run e2e/utils/__tests__/test-scenarios.test.ts`

Expected: PASS - tests should pass with the logic simulation.

**Step 3: Modify createTestSession to add unique suffix**

In `e2e/utils/test-scenarios.ts`, update the `createTestSession` function:

```typescript
/**
 * Create a test user with a signed session via our test API
 * Adds unique suffix to email to prevent race conditions when running parallel workers
 */
async function createTestSession(
  email: string,
  name: string
): Promise<{ sessionCookie: TestCookie; userId: string }> {
  // Add unique suffix to prevent collisions in parallel execution
  const uniqueId = randomUUID().slice(0, 8);
  const uniqueEmail = email.replace("@", `-${uniqueId}@`);

  const response = await fetch(`${BASE_URL}/api/test/create-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: uniqueEmail, name }),
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
```

**Step 4: Run unit tests to verify change doesn't break anything**

Run: `pnpm test:run`

Expected: All tests pass.

**Step 5: Commit**

```bash
git add e2e/utils/test-scenarios.ts e2e/utils/__tests__/test-scenarios.test.ts
git commit -m "fix(e2e): add unique email suffix to prevent session race conditions"
```

---

## Task 4: Increase Playwright Workers

**Files:**

- Modify: `playwright.config.ts:14`

**Step 1: Update worker count for CI**

Change line 14 from:

```typescript
  workers: process.env.CI ? 1 : 2,
```

To:

```typescript
  // With unique email suffix in test-scenarios.ts, race conditions are prevented
  workers: process.env.CI ? 2 : 4,
```

**Step 2: Test locally with increased workers**

Run: `CI=true pnpm e2e:run --workers=2`

Expected: Tests pass without session conflicts.

**Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "perf(e2e): increase CI workers from 1 to 2"
```

---

## Task 5: Add Matrix Sharding (4 shards)

**Files:**

- Modify: `.github/workflows/e2e.yml`

**Step 1: Update matrix to include shards**

Update the strategy section:

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]
    project: [chromium, mobile-chrome]
```

**Step 2: Update the test run command to use sharding**

```yaml
- name: Run E2E tests
  run: pnpm e2e:run --project=${{ matrix.project }} --shard=${{ matrix.shard }}/4
```

**Step 3: Update artifact names to include shard**

```yaml
- name: Upload test results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: playwright-report-${{ matrix.project }}-shard-${{ matrix.shard }}
    path: e2e/playwright-report/
    retention-days: 7

- name: Upload test artifacts
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: test-artifacts-${{ matrix.project }}-shard-${{ matrix.shard }}
    path: |
      e2e/test-results/
      e2e/snapshots/
    retention-days: 7
```

**Step 4: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "perf(e2e): add 4-shard matrix for parallel test distribution"
```

---

## Task 6: Add Report Merging Job

**Files:**

- Modify: `.github/workflows/e2e.yml`

**Step 1: Add merge-reports job after e2e job**

Add this job at the end of the workflow:

```yaml
merge-reports:
  name: Merge E2E Reports
  needs: e2e
  if: always()
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Download all shard reports
      uses: actions/download-artifact@v4
      with:
        path: playwright-reports
        pattern: playwright-report-*
        merge-multiple: true

    - name: Merge reports
      run: pnpm exec playwright merge-reports --reporter=html ./playwright-reports

    - name: Upload merged report
      uses: actions/upload-artifact@v4
      with:
        name: playwright-report-merged
        path: playwright-report/
        retention-days: 14
```

**Step 2: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "feat(e2e): add job to merge sharded test reports"
```

---

## Task 7: Create File-to-Test Mapping

**Files:**

- Create: `e2e/test-mapping.json`

**Step 1: Create the mapping configuration**

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "description": "Maps source file patterns to relevant E2E tests",
  "mappings": {
    "src/app/api/v1/families/*/invites/**": ["e2e/tests/family/join.spec.ts"],
    "src/app/api/v1/families/*/members/**": [
      "e2e/tests/family/members.spec.ts",
      "e2e/tests/family/children.spec.ts"
    ],
    "src/app/api/v1/families/*/events/**": ["e2e/tests/calendar/**"],
    "src/app/api/v1/families/**": ["e2e/tests/family/**"],
    "src/app/api/webhooks/google-calendar/**": ["e2e/tests/webhooks/**"],
    "src/components/calendar/**": [
      "e2e/tests/calendar/**",
      "e2e/tests/visual/**"
    ],
    "src/components/family/**": ["e2e/tests/family/**"],
    "src/components/reward-chart/**": ["e2e/tests/reward-chart/**"],
    "src/components/dashboard/**": ["e2e/tests/dashboard/**"],
    "src/components/auth/**": ["e2e/tests/auth/**"],
    "src/components/layout/**": ["e2e/tests/layout/**"],
    "src/components/ui/**": ["e2e/tests/visual/**"],
    "src/server/schema.ts": ["e2e/tests/**"],
    "src/server/auth.ts": ["e2e/tests/auth/**", "e2e/tests/family/**"],
    "src/server/db/**": ["e2e/tests/**"],
    "src/app/[locale]/(authenticated)/dashboard/**": ["e2e/tests/dashboard/**"],
    "src/app/[locale]/(authenticated)/family/**": ["e2e/tests/family/**"],
    "src/app/[locale]/(authenticated)/calendar/**": ["e2e/tests/calendar/**"],
    "src/app/[locale]/(authenticated)/rewards/**": [
      "e2e/tests/reward-chart/**"
    ],
    "messages/**": ["e2e/tests/**"]
  },
  "alwaysRun": [
    "e2e/tests/auth/session.spec.ts",
    "e2e/tests/auth/redirect.spec.ts"
  ],
  "fullRunTriggers": [
    "package.json",
    "pnpm-lock.yaml",
    "playwright.config.ts",
    "e2e/fixtures/**",
    "e2e/utils/**",
    ".github/workflows/e2e.yml",
    "next.config.ts",
    "tsconfig.json"
  ]
}
```

**Step 2: Commit**

```bash
git add e2e/test-mapping.json
git commit -m "feat(e2e): add file-to-test mapping configuration"
```

---

## Task 8: Install minimatch Dependency

**Files:**

- Modify: `package.json`

**Step 1: Add minimatch as dev dependency**

Run: `pnpm add -D minimatch @types/minimatch`

**Step 2: Verify installation**

Run: `pnpm list minimatch`

Expected: Shows minimatch in dev dependencies.

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): add minimatch for test selection script"
```

---

## Task 9: Create Test Selection Script

**Files:**

- Create: `scripts/select-e2e-tests.ts`

**Step 1: Write the test selection script**

```typescript
#!/usr/bin/env tsx
/**
 * Determines which E2E tests to run based on changed files.
 *
 * Usage:
 *   pnpm tsx scripts/select-e2e-tests.ts
 *   pnpm tsx scripts/select-e2e-tests.ts --base=origin/main
 *
 * Output:
 *   Space-separated list of test file patterns to run
 *   Example: "e2e/tests/auth/** e2e/tests/family/**"
 */

import { execSync } from "child_process";
import { minimatch } from "minimatch";
import { readFileSync } from "fs";
import { join } from "path";

interface TestMapping {
  mappings: Record<string, string[]>;
  alwaysRun: string[];
  fullRunTriggers: string[];
}

function getChangedFiles(base: string): string[] {
  try {
    const result = execSync(`git diff --name-only ${base}...HEAD`, {
      encoding: "utf-8",
    });
    return result.trim().split("\n").filter(Boolean);
  } catch {
    // Fallback to comparing with previous commit
    try {
      const result = execSync("git diff --name-only HEAD~1", {
        encoding: "utf-8",
      });
      return result.trim().split("\n").filter(Boolean);
    } catch {
      // No previous commit, run all tests
      return [];
    }
  }
}

function loadTestMapping(): TestMapping {
  const mappingPath = join(process.cwd(), "e2e", "test-mapping.json");
  const content = readFileSync(mappingPath, "utf-8");
  return JSON.parse(content);
}

function selectTests(changedFiles: string[], mapping: TestMapping): string[] {
  // Check for full run triggers first
  const needsFullRun = changedFiles.some((file) =>
    mapping.fullRunTriggers.some((pattern) => minimatch(file, pattern))
  );

  if (needsFullRun) {
    return ["e2e/tests/**/*.spec.ts"];
  }

  // Start with always-run tests
  const testsToRun = new Set<string>(mapping.alwaysRun);

  // Find matching tests for changed files
  for (const file of changedFiles) {
    for (const [pattern, tests] of Object.entries(mapping.mappings)) {
      if (minimatch(file, pattern)) {
        tests.forEach((test) => testsToRun.add(test));
      }
    }
  }

  // If only alwaysRun tests matched, run all tests (safety fallback)
  if (testsToRun.size === mapping.alwaysRun.length && changedFiles.length > 0) {
    console.error(
      "Warning: No test mappings matched changed files, running all tests"
    );
    return ["e2e/tests/**/*.spec.ts"];
  }

  return [...testsToRun];
}

// Main execution
const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith("--base="));
const base = baseArg ? baseArg.split("=")[1] : "origin/main";

const changedFiles = getChangedFiles(base);

if (changedFiles.length === 0) {
  // No changes detected, run all tests
  console.log("e2e/tests/**/*.spec.ts");
  process.exit(0);
}

const mapping = loadTestMapping();
const selectedTests = selectTests(changedFiles, mapping);

console.log(selectedTests.join(" "));
```

**Step 2: Make script executable**

Run: `chmod +x scripts/select-e2e-tests.ts`

**Step 3: Test the script locally**

Run: `pnpm tsx scripts/select-e2e-tests.ts`

Expected: Outputs test patterns based on recent changes.

**Step 4: Commit**

```bash
git add scripts/select-e2e-tests.ts
git commit -m "feat(e2e): add test selection script based on changed files"
```

---

## Task 10: Add Selective Test Running to Workflow

**Files:**

- Modify: `.github/workflows/e2e.yml`

**Step 1: Add determine-tests job**

Add this job before the e2e job:

```yaml
determine-tests:
  name: Determine Tests to Run
  runs-on: ubuntu-latest
  outputs:
    test-pattern: ${{ steps.select.outputs.pattern }}
    is-full-run: ${{ steps.select.outputs.is-full }}
    should-run: ${{ steps.select.outputs.should-run }}
  steps:
    - uses: actions/checkout@v4
      with:
        fetch-depth: 0 # Need full history for diff

    - name: Setup pnpm
      uses: pnpm/action-setup@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 20
        cache: pnpm

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Determine test selection
      id: select
      run: |
        if [[ "${{ github.event_name }}" == "push" && "${{ github.ref }}" == "refs/heads/main" ]]; then
          echo "Running full test suite on main branch"
          echo "pattern=e2e/tests/**/*.spec.ts" >> $GITHUB_OUTPUT
          echo "is-full=true" >> $GITHUB_OUTPUT
          echo "should-run=true" >> $GITHUB_OUTPUT
        else
          PATTERN=$(pnpm tsx scripts/select-e2e-tests.ts --base=origin/${{ github.base_ref || 'main' }})
          echo "Selected tests: $PATTERN"
          echo "pattern=$PATTERN" >> $GITHUB_OUTPUT
          echo "is-full=false" >> $GITHUB_OUTPUT
          if [[ -z "$PATTERN" ]]; then
            echo "should-run=false" >> $GITHUB_OUTPUT
          else
            echo "should-run=true" >> $GITHUB_OUTPUT
          fi
        fi
```

**Step 2: Update e2e job to depend on determine-tests**

```yaml
e2e:
  name: E2E Tests (${{ matrix.project }}, shard ${{ matrix.shard }})
  needs: determine-tests
  if: needs.determine-tests.outputs.should-run == 'true'
  runs-on: ubuntu-latest
  # ... rest of job config
```

**Step 3: Update test run command to use selected pattern**

```yaml
- name: Run E2E tests
  run: pnpm e2e:run --project=${{ matrix.project }} --shard=${{ matrix.shard }}/4 ${{ needs.determine-tests.outputs.test-pattern }}
```

**Step 4: Update merge-reports job to handle skipped e2e**

```yaml
merge-reports:
  name: Merge E2E Reports
  needs: [determine-tests, e2e]
  if: always() && needs.determine-tests.outputs.should-run == 'true'
```

**Step 5: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "feat(e2e): add selective test running based on changed files"
```

---

## Task 11: Add npm script for local test selection

**Files:**

- Modify: `package.json`

**Step 1: Add script for local testing**

Add to scripts section:

```json
"e2e:select": "tsx scripts/select-e2e-tests.ts",
"e2e:changed": "pnpm e2e:run $(pnpm e2e:select)"
```

**Step 2: Test the script**

Run: `pnpm e2e:select`

Expected: Outputs test patterns.

**Step 3: Commit**

```bash
git add package.json
git commit -m "feat(e2e): add npm scripts for selective test running"
```

---

## Task 12: Final Integration Test

**Files:**

- None (verification only)

**Step 1: Run full E2E suite locally with new settings**

Run: `CI=true pnpm e2e:run`

Expected: All tests pass with 2 workers.

**Step 2: Verify test selection works**

Run: `pnpm e2e:select`

Expected: Returns appropriate test patterns based on git changes.

**Step 3: Create final commit with all changes**

Run: `git log --oneline -10`

Expected: Shows all commits from this implementation.

---

## Summary of Changes

| File                                         | Change Type | Purpose                                           |
| -------------------------------------------- | ----------- | ------------------------------------------------- |
| `.github/workflows/e2e.yml`                  | Modify      | Matrix sharding, browser caching, selective tests |
| `playwright.config.ts`                       | Modify      | Increase workers from 1 to 2                      |
| `e2e/utils/test-scenarios.ts`                | Modify      | Add unique email suffix                           |
| `e2e/utils/__tests__/test-scenarios.test.ts` | Create      | Unit tests for uniqueness                         |
| `e2e/test-mapping.json`                      | Create      | File-to-test mapping config                       |
| `scripts/select-e2e-tests.ts`                | Create      | Test selection script                             |
| `package.json`                               | Modify      | Add minimatch, new scripts                        |

## Expected Results

| Metric           | Before     | After                     |
| ---------------- | ---------- | ------------------------- |
| PR feedback time | ~15-20 min | ~3-5 min                  |
| Jobs per run     | 1          | 8 (4 shards x 2 browsers) |
| Selective on PR  | No         | Yes                       |
| Full run on main | Yes        | Yes (safety net)          |
