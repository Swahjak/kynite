# Security Hardening Phase 2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete security hardening by implementing OAuth token encryption, structured error codes across all API routes, and Content-Type validation.

**Architecture:** Layer implementation starting with encryption utilities, then create error infrastructure, refactor all 31 API routes to use structured error codes, and finally add Content-Type validation to middleware.

**Tech Stack:** @47ng/cloak for encryption, Zod for error types, Vitest for testing

---

## Task 1: Install @47ng/cloak Dependency

**Files:**

- Modify: `package.json`

**Step 1: Install the package**

Run: `pnpm add @47ng/cloak`

**Step 2: Verify installation**

Run: `pnpm ls @47ng/cloak`
Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @47ng/cloak for token encryption"
```

---

## Task 2: Create Token Encryption Utility

**Files:**

- Create: `src/lib/encryption.ts`
- Create: `src/lib/__tests__/encryption.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/encryption.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("encryption", () => {
  const originalEnv = process.env;
  const TEST_KEY = "k1.aesgcm256.dGVzdC1rZXktdGhhdC1pcy0zMi1ieXRlcw==";

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("encryptToken", () => {
    it("encrypts a token successfully", async () => {
      const { encryptToken } = await import("../encryption");
      const token = "ya29.test-access-token";
      const encrypted = encryptToken(token);

      expect(encrypted).not.toBe(token);
      expect(encrypted).toContain("."); // Cloak format includes dots
    });

    it("produces different ciphertext each time (random IV)", async () => {
      const { encryptToken } = await import("../encryption");
      const token = "ya29.test-access-token";

      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("throws if TOKEN_ENCRYPTION_KEY is not set", async () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      const { encryptToken } = await import("../encryption");

      expect(() => encryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    });
  });

  describe("decryptToken", () => {
    it("decrypts an encrypted token back to original", async () => {
      const { encryptToken, decryptToken } = await import("../encryption");
      const original = "ya29.test-access-token";

      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(original);
    });

    it("throws on invalid ciphertext", async () => {
      const { decryptToken } = await import("../encryption");

      expect(() => decryptToken("invalid-ciphertext")).toThrow();
    });

    it("throws if TOKEN_ENCRYPTION_KEY is not set", async () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      const { decryptToken } = await import("../encryption");

      expect(() => decryptToken("test")).toThrow("TOKEN_ENCRYPTION_KEY");
    });
  });

  describe("isEncrypted", () => {
    it("returns true for encrypted values", async () => {
      const { encryptToken, isEncrypted } = await import("../encryption");
      const encrypted = encryptToken("test-token");

      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("returns false for plain text", async () => {
      const { isEncrypted } = await import("../encryption");

      expect(isEncrypted("ya29.plain-access-token")).toBe(false);
      expect(isEncrypted("1//refresh-token")).toBe(false);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/encryption.test.ts`
Expected: FAIL with "Cannot find module '../encryption'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/encryption.ts
import { encrypt, decrypt } from "@47ng/cloak";

const CLOAK_PREFIX = "v1.aesgcm256.";

/**
 * Get the encryption key from environment.
 * Throws if not configured.
 */
function getKey(): string {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is required. Generate with: pnpm dlx @47ng/cloak generate"
    );
  }
  return key;
}

/**
 * Encrypt a token for storage.
 * Uses AES-256-GCM with random IV.
 */
export function encryptToken(token: string): string {
  return encrypt(token, getKey());
}

/**
 * Decrypt a stored token.
 * Throws if decryption fails (invalid key or corrupted data).
 */
export function decryptToken(encrypted: string): string {
  return decrypt(encrypted, getKey());
}

/**
 * Check if a value appears to be encrypted.
 * Uses cloak's ciphertext format detection.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(CLOAK_PREFIX);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/encryption.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/encryption.ts src/lib/__tests__/encryption.test.ts
git commit -m "feat(security): add token encryption utility with @47ng/cloak"
```

---

## Task 3: Create Google Token Wrapper Service

**Files:**

- Create: `src/server/services/token-service.ts`
- Create: `src/server/services/__tests__/token-service.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/token-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptToken, decryptToken, isEncrypted } from "@/lib/encryption";

// Mock the encryption module
vi.mock("@/lib/encryption", () => ({
  encryptToken: vi.fn((token: string) => `encrypted:${token}`),
  decryptToken: vi.fn((encrypted: string) =>
    encrypted.replace("encrypted:", "")
  ),
  isEncrypted: vi.fn((value: string) => value.startsWith("encrypted:")),
}));

describe("token-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("prepareTokensForStorage", () => {
    it("encrypts both access and refresh tokens", async () => {
      const { prepareTokensForStorage } = await import("../token-service");

      const result = prepareTokensForStorage({
        accessToken: "access-123",
        refreshToken: "refresh-456",
      });

      expect(encryptToken).toHaveBeenCalledWith("access-123");
      expect(encryptToken).toHaveBeenCalledWith("refresh-456");
      expect(result.accessToken).toBe("encrypted:access-123");
      expect(result.refreshToken).toBe("encrypted:refresh-456");
    });

    it("handles null refresh token", async () => {
      const { prepareTokensForStorage } = await import("../token-service");

      const result = prepareTokensForStorage({
        accessToken: "access-123",
        refreshToken: null,
      });

      expect(result.refreshToken).toBeNull();
    });
  });

  describe("getDecryptedTokens", () => {
    it("decrypts encrypted tokens", async () => {
      const { getDecryptedTokens } = await import("../token-service");

      const result = getDecryptedTokens({
        accessToken: "encrypted:access-123",
        refreshToken: "encrypted:refresh-456",
      });

      expect(decryptToken).toHaveBeenCalledWith("encrypted:access-123");
      expect(decryptToken).toHaveBeenCalledWith("encrypted:refresh-456");
      expect(result.accessToken).toBe("access-123");
      expect(result.refreshToken).toBe("refresh-456");
    });

    it("returns plain tokens unchanged", async () => {
      vi.mocked(isEncrypted).mockReturnValue(false);
      const { getDecryptedTokens } = await import("../token-service");

      const result = getDecryptedTokens({
        accessToken: "ya29.plain-token",
        refreshToken: "1//plain-refresh",
      });

      expect(decryptToken).not.toHaveBeenCalled();
      expect(result.accessToken).toBe("ya29.plain-token");
      expect(result.refreshToken).toBe("1//plain-refresh");
    });

    it("handles null refresh token", async () => {
      const { getDecryptedTokens } = await import("../token-service");

      const result = getDecryptedTokens({
        accessToken: "encrypted:access-123",
        refreshToken: null,
      });

      expect(result.refreshToken).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/server/services/__tests__/token-service.test.ts`
Expected: FAIL with "Cannot find module '../token-service'"

**Step 3: Write minimal implementation**

```typescript
// src/server/services/token-service.ts
import { encryptToken, decryptToken, isEncrypted } from "@/lib/encryption";

interface TokenPair {
  accessToken: string;
  refreshToken: string | null;
}

/**
 * Encrypt tokens before storing in database.
 */
export function prepareTokensForStorage(tokens: TokenPair): TokenPair {
  return {
    accessToken: encryptToken(tokens.accessToken),
    refreshToken: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null,
  };
}

/**
 * Decrypt tokens when reading from database.
 * Handles migration: returns plain tokens unchanged if not encrypted.
 */
export function getDecryptedTokens(tokens: TokenPair): TokenPair {
  const accessToken = isEncrypted(tokens.accessToken)
    ? decryptToken(tokens.accessToken)
    : tokens.accessToken;

  const refreshToken = tokens.refreshToken
    ? isEncrypted(tokens.refreshToken)
      ? decryptToken(tokens.refreshToken)
      : tokens.refreshToken
    : null;

  return { accessToken, refreshToken };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/server/services/__tests__/token-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/token-service.ts src/server/services/__tests__/token-service.test.ts
git commit -m "feat(security): add token service for encrypt/decrypt wrapper"
```

---

## Task 4: Integrate Token Encryption into Google Account Service

**Files:**

- Modify: `src/server/services/google-account-service.ts`

**Step 1: Read current implementation**

Read the file to understand where tokens are stored and retrieved.

**Step 2: Add encryption on write**

Find all places where `accessToken` and `refreshToken` are written to the database (INSERT or UPDATE).
Wrap with `prepareTokensForStorage`:

```typescript
import { prepareTokensForStorage, getDecryptedTokens } from "./token-service";

// Before inserting/updating tokens:
const encryptedTokens = prepareTokensForStorage({
  accessToken: rawAccessToken,
  refreshToken: rawRefreshToken,
});

// Use encryptedTokens.accessToken and encryptedTokens.refreshToken in DB operation
```

**Step 3: Add decryption on read**

Find all places where tokens are read from the database.
Wrap with `getDecryptedTokens`:

```typescript
// After reading from DB:
const tokens = getDecryptedTokens({
  accessToken: account.accessToken,
  refreshToken: account.refreshToken,
});

// Use tokens.accessToken and tokens.refreshToken for API calls
```

**Step 4: Run linter and tests**

Run: `pnpm lint && pnpm test:run`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/google-account-service.ts
git commit -m "feat(security): encrypt OAuth tokens on storage"
```

---

## Task 5: Integrate Token Encryption into Google Sync Service

**Files:**

- Modify: `src/server/services/google-sync-service.ts`

**Step 1: Read current implementation**

Find where tokens are read for making Google API calls.

**Step 2: Add decryption**

Ensure tokens are decrypted before use with Google APIs:

```typescript
import { getDecryptedTokens } from "./token-service";

// When getting tokens for API call:
const tokens = getDecryptedTokens({
  accessToken: account.accessToken,
  refreshToken: account.refreshToken,
});
```

**Step 3: Run linter and tests**

Run: `pnpm lint && pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/services/google-sync-service.ts
git commit -m "feat(security): decrypt tokens when syncing with Google"
```

---

## Task 6: Create Migration Script for Existing Tokens

**Files:**

- Create: `scripts/migrate-encrypt-tokens.ts`

**Step 1: Create migration script**

```typescript
// scripts/migrate-encrypt-tokens.ts
import { db } from "@/server/db";
import { googleAccounts } from "@/server/schema";
import { encryptToken, isEncrypted } from "@/lib/encryption";

/**
 * One-time migration to encrypt existing plain-text tokens.
 * Safe to run multiple times - skips already-encrypted tokens.
 *
 * Run with: pnpm tsx scripts/migrate-encrypt-tokens.ts
 */
async function migrateTokens() {
  console.log("Starting token encryption migration...");

  const accounts = await db.select().from(googleAccounts);
  console.log(`Found ${accounts.length} Google accounts`);

  let migrated = 0;
  let skipped = 0;

  for (const account of accounts) {
    // Skip if already encrypted
    if (isEncrypted(account.accessToken)) {
      skipped++;
      continue;
    }

    // Encrypt tokens
    const encryptedAccess = encryptToken(account.accessToken);
    const encryptedRefresh = account.refreshToken
      ? encryptToken(account.refreshToken)
      : null;

    // Update database
    await db
      .update(googleAccounts)
      .set({
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
      })
      .where(eq(googleAccounts.id, account.id));

    migrated++;
    console.log(`Migrated account ${account.id}`);
  }

  console.log(`\nMigration complete:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (already encrypted): ${skipped}`);
}

// Add eq import
import { eq } from "drizzle-orm";

migrateTokens()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
```

**Step 2: Add script to package.json**

```json
"scripts": {
  "migrate:encrypt-tokens": "tsx scripts/migrate-encrypt-tokens.ts"
}
```

**Step 3: Commit**

```bash
git add scripts/migrate-encrypt-tokens.ts package.json
git commit -m "feat(security): add token encryption migration script"
```

---

## Task 7: Create Error Code Types and Utilities

**Files:**

- Create: `src/lib/errors/codes.ts`
- Create: `src/lib/errors/api-error.ts`
- Create: `src/lib/errors/index.ts`

**Step 1: Create error codes enum**

```typescript
// src/lib/errors/codes.ts

/**
 * Structured error codes for API responses.
 * See ADR: docs/adr/20251225-structured-error-codes.md
 */
export enum ErrorCode {
  // Authentication
  AUTH_REQUIRED = "AUTH_REQUIRED",
  AUTH_INVALID = "AUTH_INVALID",
  AUTH_EXPIRED = "AUTH_EXPIRED",

  // Authorization
  FORBIDDEN = "FORBIDDEN",
  NOT_FAMILY_MEMBER = "NOT_FAMILY_MEMBER",
  MANAGER_REQUIRED = "MANAGER_REQUIRED",

  // Resources
  NOT_FOUND = "NOT_FOUND",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Rate Limiting
  RATE_LIMITED = "RATE_LIMITED",
  TOO_MANY_ATTEMPTS = "TOO_MANY_ATTEMPTS",

  // External Services
  GOOGLE_ERROR = "GOOGLE_ERROR",
  PUSHER_ERROR = "PUSHER_ERROR",

  // Generic
  INTERNAL_ERROR = "INTERNAL_ERROR",
  BAD_REQUEST = "BAD_REQUEST",
}

/**
 * Human-readable messages for error codes.
 * Production uses generic messages; development can show details.
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_REQUIRED]: "Authentication required",
  [ErrorCode.AUTH_INVALID]: "Invalid credentials",
  [ErrorCode.AUTH_EXPIRED]: "Session expired",
  [ErrorCode.FORBIDDEN]: "Access denied",
  [ErrorCode.NOT_FAMILY_MEMBER]: "Not a member of this family",
  [ErrorCode.MANAGER_REQUIRED]: "Manager role required",
  [ErrorCode.NOT_FOUND]: "Resource not found",
  [ErrorCode.ALREADY_EXISTS]: "Resource already exists",
  [ErrorCode.VALIDATION_ERROR]: "Invalid input",
  [ErrorCode.INVALID_INPUT]: "Invalid request data",
  [ErrorCode.RATE_LIMITED]: "Too many requests",
  [ErrorCode.TOO_MANY_ATTEMPTS]: "Maximum attempts exceeded",
  [ErrorCode.GOOGLE_ERROR]: "Google service error",
  [ErrorCode.PUSHER_ERROR]: "Real-time service error",
  [ErrorCode.INTERNAL_ERROR]: "Something went wrong",
  [ErrorCode.BAD_REQUEST]: "Bad request",
};

/**
 * HTTP status codes for each error type.
 */
export const ErrorStatusCodes: Record<ErrorCode, number> = {
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.AUTH_INVALID]: 401,
  [ErrorCode.AUTH_EXPIRED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FAMILY_MEMBER]: 403,
  [ErrorCode.MANAGER_REQUIRED]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.TOO_MANY_ATTEMPTS]: 429,
  [ErrorCode.GOOGLE_ERROR]: 502,
  [ErrorCode.PUSHER_ERROR]: 502,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_REQUEST]: 400,
};
```

**Step 2: Create ApiError class**

```typescript
// src/lib/errors/api-error.ts
import { NextResponse } from "next/server";
import { ErrorCode, ErrorMessages, ErrorStatusCodes } from "./codes";

export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a structured error response.
 * In production, hides details. In development, includes them.
 */
export function createErrorResponse(
  code: ErrorCode,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const isDev = process.env.NODE_ENV === "development";

  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message: ErrorMessages[code],
      ...(isDev && details ? { details } : {}),
    },
  };

  return NextResponse.json(response, {
    status: ErrorStatusCodes[code],
  });
}

/**
 * Shorthand error response creators for common cases.
 */
export const Errors = {
  unauthorized: (details?: unknown) =>
    createErrorResponse(ErrorCode.AUTH_REQUIRED, details),

  forbidden: (details?: unknown) =>
    createErrorResponse(ErrorCode.FORBIDDEN, details),

  notFound: (resource?: string) =>
    createErrorResponse(
      ErrorCode.NOT_FOUND,
      resource ? { resource } : undefined
    ),

  validation: (errors: unknown) =>
    createErrorResponse(ErrorCode.VALIDATION_ERROR, errors),

  notFamilyMember: (details?: unknown) =>
    createErrorResponse(ErrorCode.NOT_FAMILY_MEMBER, details),

  managerRequired: (details?: unknown) =>
    createErrorResponse(ErrorCode.MANAGER_REQUIRED, details),

  googleError: (details?: unknown) =>
    createErrorResponse(ErrorCode.GOOGLE_ERROR, details),

  internal: (details?: unknown) =>
    createErrorResponse(ErrorCode.INTERNAL_ERROR, details),

  badRequest: (details?: unknown) =>
    createErrorResponse(ErrorCode.BAD_REQUEST, details),
};
```

**Step 3: Create index file**

```typescript
// src/lib/errors/index.ts
export { ErrorCode, ErrorMessages, ErrorStatusCodes } from "./codes";
export {
  createErrorResponse,
  Errors,
  type ApiErrorResponse,
} from "./api-error";
```

**Step 4: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/errors/
git commit -m "feat(security): add structured error code infrastructure"
```

---

## Task 8: Refactor Auth API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/families/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/route.ts`

**Step 1: Read current implementation**

Read both files to understand current error handling patterns.

**Step 2: Replace ad-hoc errors with Errors helpers**

For each file, replace patterns like:

```typescript
// Before:
return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

// After:
import { Errors } from "@/lib/errors";
return Errors.unauthorized();
```

Common replacements:

| Before                                  | After                      |
| --------------------------------------- | -------------------------- |
| `{ error: "Not authenticated" }, 401`   | `Errors.unauthorized()`    |
| `{ error: "Forbidden" }, 403`           | `Errors.forbidden()`       |
| `{ error: "Not found" }, 404`           | `Errors.notFound()`        |
| `{ error: "Not a family member" }, 403` | `Errors.notFamilyMember()` |
| `{ error: "Manager required" }, 403`    | `Errors.managerRequired()` |
| `{ success: false, error: {...} }, 400` | `Errors.validation(error)` |

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/route.ts src/app/api/v1/families/\[familyId\]/route.ts
git commit -m "refactor(api): use structured errors in families routes"
```

---

## Task 9: Refactor Calendar API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/calendars/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

Follow same pattern as Task 8.

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/calendars/
git commit -m "refactor(api): use structured errors in calendar routes"
```

---

## Task 10: Refactor Device API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/devices/route.ts`
- Modify: `src/app/api/v1/devices/[id]/route.ts`
- Modify: `src/app/api/v1/devices/pair/generate/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/devices/
git commit -m "refactor(api): use structured errors in device routes"
```

---

## Task 11: Refactor Invite API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/invites/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts`
- Modify: `src/app/api/v1/invites/[token]/route.ts`
- Modify: `src/app/api/v1/invites/[token]/accept/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/invites/ src/app/api/v1/invites/
git commit -m "refactor(api): use structured errors in invite routes"
```

---

## Task 12: Refactor Member API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/members/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/stars/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/stars/bonus/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/primary-goal/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/redemptions/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/members/
git commit -m "refactor(api): use structured errors in member routes"
```

---

## Task 13: Refactor Rewards API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/rewards/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/rewards/[rewardId]/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/rewards/[rewardId]/redeem/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/rewards/
git commit -m "refactor(api): use structured errors in reward routes"
```

---

## Task 14: Refactor Timer API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/timers/active/route.ts`
- Modify: `src/app/api/v1/timers/active/[id]/route.ts`
- Modify: `src/app/api/v1/timers/active/[id]/confirm/route.ts`
- Modify: `src/app/api/v1/timers/templates/route.ts`
- Modify: `src/app/api/v1/timers/templates/[id]/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/timers/
git commit -m "refactor(api): use structured errors in timer routes"
```

---

## Task 15: Refactor Account API Routes to Use Structured Errors

**Files:**

- Modify: `src/app/api/v1/accounts/linked/route.ts`
- Modify: `src/app/api/v1/accounts/linked/[accountId]/route.ts`
- Modify: `src/app/api/v1/google/calendars/route.ts`

**Step 1: Read current implementations**

**Step 2: Replace errors with Errors helpers**

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/accounts/ src/app/api/v1/google/
git commit -m "refactor(api): use structured errors in account routes"
```

---

## Task 16: Add Content-Type Validation to Middleware

**Files:**

- Modify: `src/middleware.ts`

**Step 1: Read current middleware**

Check existing middleware implementation from Phase 1 (Origin validation).

**Step 2: Add Content-Type validation**

```typescript
// Add to middleware after Origin validation:

// Validate Content-Type for requests with body
if (["POST", "PUT", "PATCH"].includes(request.method)) {
  // Skip for multipart (file uploads)
  const contentType = request.headers.get("content-type") || "";

  if (request.nextUrl.pathname.startsWith("/api/")) {
    // Skip webhooks (may use different content types)
    if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
      return NextResponse.next();
    }

    // Require JSON content type for API routes
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Content-Type must be application/json",
          },
        },
        { status: 415 }
      );
    }
  }
}
```

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(security): add Content-Type validation for API routes"
```

---

## Task 17: Add TOKEN_ENCRYPTION_KEY Validation

**Files:**

- Modify: `src/lib/env.ts`

**Step 1: Read current implementation**

**Step 2: Add TOKEN_ENCRYPTION_KEY requirement**

```typescript
// Add after CRON_SECRET validation:

// TOKEN_ENCRYPTION_KEY is required in production
if (isProduction && !process.env.TOKEN_ENCRYPTION_KEY) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY is required in production. Generate with: pnpm dlx @47ng/cloak generate"
  );
}

// Export updated env
export const env = {
  CRON_SECRET: process.env.CRON_SECRET,
  TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
  isProduction,
};
```

**Step 3: Update env tests**

Add test for TOKEN_ENCRYPTION_KEY requirement.

**Step 4: Run tests**

Run: `pnpm vitest run src/lib/__tests__/env.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/__tests__/env.test.ts
git commit -m "feat(security): require TOKEN_ENCRYPTION_KEY in production"
```

---

## Task 18: Update CI Environment Variables

**Files:**

- Modify: `.github/workflows/ci.yml`

**Step 1: Add TOKEN_ENCRYPTION_KEY**

```yaml
# Add to env section:
TOKEN_ENCRYPTION_KEY: "k1.aesgcm256.Y2ktdGVzdC1rZXktMzItYnl0ZXMtbG9uZw=="
```

**Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): add TOKEN_ENCRYPTION_KEY for build"
```

---

## Task 19: Final Verification

**Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests PASS

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Create summary commit**

```bash
git add -A
git commit -m "chore(security): complete security hardening phase 2

Implements:
- OAuth token encryption with @47ng/cloak
- Token encryption migration script
- Structured error codes across all 31 API routes
- Content-Type validation in middleware
- TOKEN_ENCRYPTION_KEY environment validation

See docs/adr/ for architectural decisions."
```

---

## Execution Notes

### Parallel Execution Groups

**Phase A (Foundation - Sequential):**

- Tasks 1-3: Encryption utility and wrapper

**Phase B (Integration - Sequential):**

- Tasks 4-6: Apply encryption to services

**Phase C (Error Infrastructure - Can run after Phase A):**

- Task 7: Create error types

**Phase D (API Refactoring - Parallel after Phase C):**

- Tasks 8-15: Each route group can run in parallel

**Phase E (Middleware - After Phase D):**

- Task 16: Content-Type validation

**Phase F (Final - Sequential):**

- Tasks 17-19: Environment, CI, verification

### External Configuration Required

After deployment:

1. Generate encryption key: `pnpm dlx @47ng/cloak generate`
2. Add `TOKEN_ENCRYPTION_KEY` to Vercel environment
3. Run migration: `pnpm migrate:encrypt-tokens`

### Rollback Plan

If issues occur with encrypted tokens:

1. Plain tokens remain readable (migration is non-destructive)
2. Can revert code without data loss
3. Users may need to re-link Google accounts if key is lost
