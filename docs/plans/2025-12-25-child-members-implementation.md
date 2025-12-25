# Child Members Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow managers to add child family members without Google accounts, with an optional upgrade path to link an account later.

**Architecture:** Children are placeholder users (`type: "child"`) with synthetic emails. They appear as family members (`role: "child"`) and can interact via the wall hub device. When ready, a parent generates an upgrade token that allows the child to link a Google account.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, PostgreSQL, Zod validation, better-auth

---

## Task 1: Update Type Definitions

**Files:**

- Modify: `src/types/family.ts`

**Step 1: Write test for new role type**

```typescript
// src/types/__tests__/family.test.ts
import { describe, it, expect } from "vitest";
import { FAMILY_MEMBER_ROLES, AVATAR_COLORS } from "../family";

describe("family types", () => {
  it("includes child role", () => {
    expect(FAMILY_MEMBER_ROLES).toContain("child");
  });

  it("has all expected roles", () => {
    expect(FAMILY_MEMBER_ROLES).toEqual([
      "manager",
      "participant",
      "caregiver",
      "child",
    ]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/types/__tests__/family.test.ts`
Expected: FAIL - child not in array

**Step 3: Add child role to types**

```typescript
// src/types/family.ts
export type FamilyMemberRole =
  | "manager"
  | "participant"
  | "caregiver"
  | "device"
  | "child";

export const FAMILY_MEMBER_ROLES: FamilyMemberRole[] = [
  "manager",
  "participant",
  "caregiver",
  "child",
];
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/types/__tests__/family.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/family.ts src/types/__tests__/family.test.ts
git commit -m "feat(types): add child role to FamilyMemberRole"
```

---

## Task 2: Add childUpgradeTokens Table to Schema

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add table definition**

Add after `devicePairingCodes` table:

```typescript
/**
 * Child Upgrade Tokens table - One-time tokens for linking a child to an account
 */
export const childUpgradeTokens = pgTable("child_upgrade_tokens", {
  id: text("id").primaryKey(),
  childUserId: text("child_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations**

```typescript
export const childUpgradeTokensRelations = relations(
  childUpgradeTokens,
  ({ one }) => ({
    childUser: one(users, {
      fields: [childUpgradeTokens.childUserId],
      references: [users.id],
      relationName: "childUpgradeTokens",
    }),
    createdBy: one(users, {
      fields: [childUpgradeTokens.createdById],
      references: [users.id],
      relationName: "createdUpgradeTokens",
    }),
  })
);
```

**Step 3: Add type exports**

```typescript
export type ChildUpgradeToken = typeof childUpgradeTokens.$inferSelect;
export type NewChildUpgradeToken = typeof childUpgradeTokens.$inferInsert;
```

**Step 4: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created

**Step 5: Run migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 6: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(schema): add childUpgradeTokens table"
```

---

## Task 3: Create Child Validation Schema

**Files:**

- Modify: `src/lib/validations/family.ts`

**Step 1: Write test for validation schema**

```typescript
// src/lib/validations/__tests__/family.test.ts
import { describe, it, expect } from "vitest";
import { createChildSchema } from "../family";

describe("createChildSchema", () => {
  it("validates valid input", () => {
    const result = createChildSchema.safeParse({
      name: "Emma",
      avatarColor: "blue",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createChildSchema.safeParse({
      name: "",
      avatarColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name over 50 chars", () => {
    const result = createChildSchema.safeParse({
      name: "a".repeat(51),
      avatarColor: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid avatar color", () => {
    const result = createChildSchema.safeParse({
      name: "Emma",
      avatarColor: "magenta",
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/validations/__tests__/family.test.ts`
Expected: FAIL - createChildSchema not found

**Step 3: Add validation schema**

```typescript
// Add to src/lib/validations/family.ts
export const createChildSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  avatarColor: z.enum(AVATAR_COLORS as [string, ...string[]]),
});

export type CreateChildInput = z.infer<typeof createChildSchema>;
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/validations/__tests__/family.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/validations/family.ts src/lib/validations/__tests__/family.test.ts
git commit -m "feat(validation): add createChildSchema"
```

---

## Task 4: Create Child Service Functions

**Files:**

- Create: `src/server/services/child-service.ts`
- Create: `src/server/services/__tests__/child-service.test.ts`

**Step 1: Write test for createChildMember**

```typescript
// src/server/services/__tests__/child-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("@/server/db", () => ({
  db: {
    transaction: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

describe("child-service", () => {
  describe("createChildMember", () => {
    it("creates placeholder user and family member", async () => {
      // This will be an integration test in practice
      // For unit test, we verify the function exists and has correct signature
      const { createChildMember } = await import("../child-service");
      expect(typeof createChildMember).toBe("function");
    });
  });
});
```

**Step 2: Create child service**

```typescript
// src/server/services/child-service.ts
import { db } from "@/server/db";
import { users, familyMembers, childUpgradeTokens } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { generateInviteToken } from "@/lib/invite-token";

/**
 * Create a child member (placeholder user + family member)
 * Children have no password/OAuth - they're profiles managed by parents
 */
export async function createChildMember(
  familyId: string,
  name: string,
  avatarColor: string
) {
  const childId = `child_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const memberId = randomUUID();
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Create placeholder user
    const [user] = await tx
      .insert(users)
      .values({
        id: childId,
        name,
        email: `${childId}@placeholder.internal`,
        emailVerified: false,
        type: "child",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Create family member
    const [member] = await tx
      .insert(familyMembers)
      .values({
        id: memberId,
        familyId,
        userId: childId,
        role: "child",
        displayName: name,
        avatarColor,
        createdAt: now,
      })
      .returning();

    return { user, member };
  });
}

/**
 * Count children in a family (for limit enforcement)
 */
export async function countChildrenInFamily(familyId: string): Promise<number> {
  const children = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "child"))
    );

  return children.length;
}

/**
 * Create an upgrade token for a child to link a Google account
 * Token expires in 24 hours
 */
export async function createUpgradeToken(
  childUserId: string,
  createdById: string
) {
  const tokenId = randomUUID();
  const token = generateInviteToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const [upgradeToken] = await db
    .insert(childUpgradeTokens)
    .values({
      id: tokenId,
      childUserId,
      token,
      createdById,
      expiresAt,
      createdAt: now,
    })
    .returning();

  return upgradeToken;
}

/**
 * Get upgrade token by token string
 * Returns null if not found or expired
 */
export async function getUpgradeToken(token: string) {
  const tokens = await db
    .select()
    .from(childUpgradeTokens)
    .where(eq(childUpgradeTokens.token, token))
    .limit(1);

  if (tokens.length === 0) {
    return null;
  }

  const upgradeToken = tokens[0];

  // Check if expired
  if (upgradeToken.expiresAt < new Date()) {
    return null;
  }

  // Check if already used
  if (upgradeToken.usedAt) {
    return null;
  }

  return upgradeToken;
}

/**
 * Upgrade a child to a full account
 * Links existing child profile to the new authenticated user
 */
export async function upgradeChildToAccount(
  token: string,
  newEmail: string,
  newName: string
) {
  return await db.transaction(async (tx) => {
    // Get and validate token
    const tokens = await tx
      .select()
      .from(childUpgradeTokens)
      .where(eq(childUpgradeTokens.token, token))
      .limit(1);

    if (tokens.length === 0) {
      throw new Error("Invalid token");
    }

    const upgradeToken = tokens[0];

    if (upgradeToken.expiresAt < new Date()) {
      throw new Error("Token expired");
    }

    if (upgradeToken.usedAt) {
      throw new Error("Token already used");
    }

    // Check if email already in use
    const existingUser = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, newEmail))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error("Email already in use");
    }

    // Update user record
    const now = new Date();
    const [updatedUser] = await tx
      .update(users)
      .set({
        email: newEmail,
        name: newName,
        type: "human",
        updatedAt: now,
      })
      .where(eq(users.id, upgradeToken.childUserId))
      .returning();

    // Update family member role
    await tx
      .update(familyMembers)
      .set({ role: "participant" })
      .where(eq(familyMembers.userId, upgradeToken.childUserId));

    // Mark token as used
    await tx
      .update(childUpgradeTokens)
      .set({ usedAt: now })
      .where(eq(childUpgradeTokens.id, upgradeToken.id));

    return updatedUser;
  });
}
```

**Step 3: Run test to verify it passes**

Run: `pnpm test src/server/services/__tests__/child-service.test.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add src/server/services/child-service.ts src/server/services/__tests__/child-service.test.ts
git commit -m "feat(service): add child-service with create/upgrade functions"
```

---

## Task 5: Create POST /api/v1/families/[familyId]/children Endpoint

**Files:**

- Create: `src/app/api/v1/families/[familyId]/children/route.ts`

**Step 1: Create the route handler**

```typescript
// src/app/api/v1/families/[familyId]/children/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyManager } from "@/server/services/family-service";
import {
  createChildMember,
  countChildrenInFamily,
} from "@/server/services/child-service";
import { createChildSchema } from "@/lib/validations/family";
import { Errors } from "@/lib/errors";

const MAX_CHILDREN_PER_FAMILY = 10;

type Params = { params: Promise<{ familyId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    // Only managers can add children
    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parsed = createChildSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error.flatten());
    }

    // Check child limit
    const childCount = await countChildrenInFamily(familyId);
    if (childCount >= MAX_CHILDREN_PER_FAMILY) {
      return Errors.validation({
        _errors: [`Maximum of ${MAX_CHILDREN_PER_FAMILY} children per family`],
      });
    }

    const { user, member } = await createChildMember(
      familyId,
      parsed.data.name,
      parsed.data.avatarColor
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          member: {
            id: member.id,
            familyId: member.familyId,
            userId: member.userId,
            role: member.role,
            displayName: member.displayName,
            avatarColor: member.avatarColor,
            createdAt: member.createdAt,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating child member:", error);
    return Errors.internal("Failed to create child member");
  }
}
```

**Step 2: Run linting to verify no errors**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/children/route.ts
git commit -m "feat(api): add POST /api/v1/families/[familyId]/children endpoint"
```

---

## Task 6: Create GET /api/v1/families/[familyId]/children Endpoint

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/children/route.ts`

**Step 1: Add GET handler**

Add to existing route.ts:

```typescript
import { db } from "@/server/db";
import { familyMembers, users } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { isUserFamilyMember } from "@/server/services/family-service";

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    // Any family member can view children
    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return Errors.notFamilyMember();
    }

    const children = await db
      .select({
        id: familyMembers.id,
        familyId: familyMembers.familyId,
        userId: familyMembers.userId,
        role: familyMembers.role,
        displayName: familyMembers.displayName,
        avatarColor: familyMembers.avatarColor,
        createdAt: familyMembers.createdAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(familyMembers)
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.role, "child")
        )
      );

    return NextResponse.json({
      success: true,
      data: { children },
    });
  } catch (error) {
    console.error("Error listing children:", error);
    return Errors.internal("Failed to list children");
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/children/route.ts
git commit -m "feat(api): add GET /api/v1/families/[familyId]/children endpoint"
```

---

## Task 7: Create Upgrade Token Endpoint

**Files:**

- Create: `src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts`

**Step 1: Create the route handler**

```typescript
// src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { isUserFamilyManager } from "@/server/services/family-service";
import { createUpgradeToken } from "@/server/services/child-service";
import { Errors } from "@/lib/errors";

type Params = {
  params: Promise<{ familyId: string; childMemberId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId, childMemberId } = await params;

    // Only managers can create upgrade tokens
    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    // Get the child member
    const childMember = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, childMemberId),
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.role, "child")
        )
      )
      .limit(1);

    if (childMember.length === 0) {
      return Errors.notFound("child member");
    }

    const upgradeToken = await createUpgradeToken(
      childMember[0].userId,
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          token: upgradeToken.token,
          expiresAt: upgradeToken.expiresAt,
          linkUrl: `/link-account?token=${upgradeToken.token}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating upgrade token:", error);
    return Errors.internal("Failed to create upgrade token");
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts
git commit -m "feat(api): add POST upgrade-token endpoint for child accounts"
```

---

## Task 8: Update getFamilyMembers to Include Children

**Files:**

- Modify: `src/server/services/family-service.ts`

**Step 1: Update the filter logic**

Current code filters out devices with `filter((m) => m.role !== "device")`. Children should be included in the regular members list.

```typescript
// Update getFamilyMembers to NOT filter children
// Change this line:
.filter((m) => m.role !== "device")
// Children are included by default since we only exclude "device"
```

**Step 2: Verify existing tests still pass**

Run: `pnpm test:run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/services/family-service.ts
git commit -m "refactor(service): ensure children included in getFamilyMembers"
```

---

## Task 9: Add i18n Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` under appropriate section:

```json
{
  "Family": {
    "addChild": "Add Child",
    "childName": "Child's Name",
    "childNamePlaceholder": "Enter child's name",
    "selectAvatarColor": "Select Avatar Color",
    "createChild": "Create Child",
    "childCreated": "Child added successfully",
    "linkAccount": "Link Account",
    "generateUpgradeLink": "Generate Link",
    "upgradeLinkGenerated": "Account link generated",
    "copyLink": "Copy Link",
    "linkExpires": "Link expires in 24 hours",
    "maxChildrenReached": "Maximum number of children reached"
  }
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
{
  "Family": {
    "addChild": "Kind toevoegen",
    "childName": "Naam van kind",
    "childNamePlaceholder": "Voer naam van kind in",
    "selectAvatarColor": "Selecteer avatarkleur",
    "createChild": "Kind aanmaken",
    "childCreated": "Kind succesvol toegevoegd",
    "linkAccount": "Account koppelen",
    "generateUpgradeLink": "Link genereren",
    "upgradeLinkGenerated": "Accountlink gegenereerd",
    "copyLink": "Link kopiëren",
    "linkExpires": "Link verloopt over 24 uur",
    "maxChildrenReached": "Maximum aantal kinderen bereikt"
  }
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add child member translations"
```

---

## Task 10: Run Full Test Suite and Build

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit any fixes**

If any fixes needed, commit them.

---

## Summary

After completing all tasks:

1. **Types** - `FamilyMemberRole` now includes `"child"`
2. **Schema** - `childUpgradeTokens` table added
3. **Validation** - `createChildSchema` for API input validation
4. **Service** - `child-service.ts` with create/upgrade functions
5. **API** - New endpoints:
   - `GET/POST /api/v1/families/[familyId]/children`
   - `POST /api/v1/families/[familyId]/children/[childMemberId]/upgrade-token`
6. **i18n** - Translations for child-related UI text

**Not included in this plan** (future work):

- UI components for family settings
- Link account page (`/link-account`)
- E2E tests
