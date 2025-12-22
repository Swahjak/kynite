# Families Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement household management with role-based access (manager/participant/caregiver), requiring family membership before calendar access.

**Architecture:** Three database tables (families, family_members, family_invites) with API routes for CRUD operations. Middleware enforces family membership via cookie check. Onboarding flow guides new users through family creation. Shareable invite links allow adding members without email integration.

**Tech Stack:** Next.js 16, Drizzle ORM, PostgreSQL, Better-Auth, shadcn/ui, react-hook-form, Zod, next-intl

---

## Task 1: Database Schema - Families Table

**Files:**
- Modify: `src/server/schema.ts`

**Step 1: Add families table to schema**

```typescript
// Add after existing Better-Auth tables in src/server/schema.ts

export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
```

**Step 2: Verify schema compiles**

Run: `pnpm build`
Expected: Build succeeds without type errors

**Step 3: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(db): add families table schema"
```

---

## Task 2: Database Schema - Family Members Table

**Files:**
- Modify: `src/server/schema.ts`

**Step 1: Add family_members table to schema**

```typescript
// Add after families table in src/server/schema.ts

export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'manager' | 'participant' | 'caregiver'
  displayName: text("display_name"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;
```

**Step 2: Verify schema compiles**

Run: `pnpm build`
Expected: Build succeeds without type errors

**Step 3: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(db): add family_members table schema"
```

---

## Task 3: Database Schema - Family Invites Table

**Files:**
- Modify: `src/server/schema.ts`

**Step 1: Add family_invites table to schema**

```typescript
// Add after familyMembers table in src/server/schema.ts

export const familyInvites = pgTable("family_invites", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type FamilyInvite = typeof familyInvites.$inferSelect;
export type NewFamilyInvite = typeof familyInvites.$inferInsert;
```

**Step 2: Add integer import to drizzle-orm/pg-core**

Ensure the import at the top includes `integer`:
```typescript
import { pgTable, text, timestamp, boolean, integer } from "drizzle-orm/pg-core";
```

**Step 3: Verify schema compiles**

Run: `pnpm build`
Expected: Build succeeds without type errors

**Step 4: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(db): add family_invites table schema"
```

---

## Task 4: Database Schema - Drizzle Relations

**Files:**
- Modify: `src/server/schema.ts`

**Step 1: Add relations import and define relations**

```typescript
// Add to imports at top of src/server/schema.ts
import { relations } from "drizzle-orm";

// Add after table definitions

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
  invites: many(familyInvites),
}));

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
}));

export const familyInvitesRelations = relations(familyInvites, ({ one }) => ({
  family: one(families, {
    fields: [familyInvites.familyId],
    references: [families.id],
  }),
  createdBy: one(users, {
    fields: [familyInvites.createdById],
    references: [users.id],
  }),
}));
```

**Step 2: Verify schema compiles**

Run: `pnpm build`
Expected: Build succeeds without type errors

**Step 3: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(db): add drizzle relations for family tables"
```

---

## Task 5: Generate and Run Database Migration

**Files:**
- Create: `drizzle/XXXX_add_families.sql` (auto-generated)

**Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created in `drizzle/` directory

**Step 2: Run migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 3: Verify tables exist**

Run: `pnpm db:studio`
Expected: Drizzle Studio opens, showing families, family_members, family_invites tables

**Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for family tables"
```

---

## Task 6: Family Types

**Files:**
- Create: `src/types/family.ts`

**Step 1: Create family types file**

```typescript
// src/types/family.ts

export type FamilyMemberRole = "manager" | "participant" | "caregiver";

export type AvatarColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "teal";

export const AVATAR_COLORS: AvatarColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "pink",
  "teal",
];

export const FAMILY_MEMBER_ROLES: FamilyMemberRole[] = [
  "manager",
  "participant",
  "caregiver",
];

export interface FamilyMemberWithUser {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMemberRole;
  displayName: string | null;
  avatarColor: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface FamilyWithMembers {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  members: FamilyMemberWithUser[];
}
```

**Step 2: Verify types compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/types/family.ts
git commit -m "feat(types): add family type definitions"
```

---

## Task 7: Validation Schemas

**Files:**
- Create: `src/lib/validations/family.ts`

**Step 1: Create validation schemas**

```typescript
// src/lib/validations/family.ts

import { z } from "zod";
import { AVATAR_COLORS, FAMILY_MEMBER_ROLES } from "@/types/family";

export const createFamilySchema = z.object({
  name: z
    .string()
    .min(1, "Family name is required")
    .max(50, "Family name must be 50 characters or less"),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

export const updateFamilySchema = z.object({
  name: z
    .string()
    .min(1, "Family name is required")
    .max(50, "Family name must be 50 characters or less"),
});

export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;

export const updateMemberSchema = z.object({
  displayName: z
    .string()
    .max(50, "Display name must be 50 characters or less")
    .optional()
    .nullable(),
  avatarColor: z.enum(AVATAR_COLORS as [string, ...string[]]).optional().nullable(),
  role: z.enum(FAMILY_MEMBER_ROLES as [string, ...string[]]).optional(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const createInviteSchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(100).optional(),
});

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
```

**Step 2: Verify schemas compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/validations/family.ts
git commit -m "feat(validation): add family zod schemas"
```

---

## Task 8: Invite Token Utility

**Files:**
- Create: `src/lib/invite-token.ts`

**Step 1: Create invite token utility**

```typescript
// src/lib/invite-token.ts

import { randomBytes } from "crypto";

export function generateInviteToken(): string {
  return randomBytes(16).toString("hex"); // 32 character hex string
}

export function getInviteUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/join/${token}`;
}
```

**Step 2: Verify utility compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/invite-token.ts
git commit -m "feat(util): add invite token generator"
```

---

## Task 9: Family Service - Get User's Family

**Files:**
- Create: `src/server/services/family-service.ts`

**Step 1: Create family service with getUserFamily function**

```typescript
// src/server/services/family-service.ts

import { db } from "@/server/db";
import { families, familyMembers, users } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";

export async function getUserFamily(userId: string) {
  const membership = await db
    .select({
      familyId: familyMembers.familyId,
      role: familyMembers.role,
    })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId))
    .limit(1);

  if (membership.length === 0) {
    return null;
  }

  const family = await db
    .select()
    .from(families)
    .where(eq(families.id, membership[0].familyId))
    .limit(1);

  if (family.length === 0) {
    return null;
  }

  return {
    ...family[0],
    currentUserRole: membership[0].role as FamilyMemberRole,
  };
}

export async function getFamilyMembers(
  familyId: string
): Promise<FamilyMemberWithUser[]> {
  const members = await db
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
    .where(eq(familyMembers.familyId, familyId));

  return members.map((m) => ({
    ...m,
    role: m.role as FamilyMemberRole,
  }));
}

export async function isUserFamilyManager(
  userId: string,
  familyId: string
): Promise<boolean> {
  const membership = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(
      and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId))
    )
    .limit(1);

  return membership.length > 0 && membership[0].role === "manager";
}

export async function isUserFamilyMember(
  userId: string,
  familyId: string
): Promise<boolean> {
  const membership = await db
    .select({ id: familyMembers.id })
    .from(familyMembers)
    .where(
      and(eq(familyMembers.userId, userId), eq(familyMembers.familyId, familyId))
    )
    .limit(1);

  return membership.length > 0;
}
```

**Step 2: Verify service compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/server/services/family-service.ts
git commit -m "feat(service): add family service with core queries"
```

---

## Task 10: API Route - Create Family (POST /api/v1/families)

**Files:**
- Create: `src/app/api/v1/families/route.ts`

**Step 1: Create families API route with POST handler**

```typescript
// src/app/api/v1/families/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { createFamilySchema } from "@/lib/validations/family";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
        },
        { status: 400 }
      );
    }

    const familyId = randomUUID();
    const memberId = randomUUID();
    const now = new Date();

    // Create family
    await db.insert(families).values({
      id: familyId,
      name: parsed.data.name,
      createdAt: now,
      updatedAt: now,
    });

    // Add creator as manager
    await db.insert(familyMembers).values({
      id: memberId,
      familyId: familyId,
      userId: session.user.id,
      role: "manager",
      createdAt: now,
    });

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        family: family[0],
        membership: {
          id: memberId,
          familyId,
          userId: session.user.id,
          role: "manager",
        },
      },
    });
  } catch (error) {
    console.error("Error creating family:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create family" } },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const userFamilies = await db
      .select({
        id: families.id,
        name: families.name,
        createdAt: families.createdAt,
        updatedAt: families.updatedAt,
        role: familyMembers.role,
      })
      .from(families)
      .innerJoin(familyMembers, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, session.user.id));

    return NextResponse.json({
      success: true,
      data: { families: userFamilies },
    });
  } catch (error) {
    console.error("Error listing families:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list families" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/route.ts
git commit -m "feat(api): add POST/GET /api/v1/families routes"
```

---

## Task 11: API Route - Family by ID (GET/PATCH/DELETE)

**Files:**
- Create: `src/app/api/v1/families/[familyId]/route.ts`

**Step 1: Create family by ID route**

```typescript
// src/app/api/v1/families/[familyId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateFamilySchema } from "@/lib/validations/family";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not a member of this family" } },
        { status: 403 }
      );
    }

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    if (family.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Family not found" } },
        { status: 404 }
      );
    }

    const members = await getFamilyMembers(familyId);
    const currentMember = members.find((m) => m.userId === session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        family: family[0],
        members,
        currentUserRole: currentMember?.role,
      },
    });
  } catch (error) {
    console.error("Error getting family:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to get family" } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can update the family" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
        },
        { status: 400 }
      );
    }

    await db
      .update(families)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(families.id, familyId));

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { family: family[0] },
    });
  } catch (error) {
    console.error("Error updating family:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update family" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can delete the family" } },
        { status: 403 }
      );
    }

    await db.delete(families).where(eq(families.id, familyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete family" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/route.ts
git commit -m "feat(api): add GET/PATCH/DELETE /api/v1/families/[familyId] routes"
```

---

## Task 12: API Route - Family Members

**Files:**
- Create: `src/app/api/v1/families/[familyId]/members/route.ts`

**Step 1: Create members list route**

```typescript
// src/app/api/v1/families/[familyId]/members/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getFamilyMembers, isUserFamilyMember } from "@/server/services/family-service";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not a member of this family" } },
        { status: 403 }
      );
    }

    const members = await getFamilyMembers(familyId);

    return NextResponse.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list members" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/members/route.ts
git commit -m "feat(api): add GET /api/v1/families/[familyId]/members route"
```

---

## Task 13: API Route - Member by ID (PATCH/DELETE)

**Files:**
- Create: `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts`

**Step 1: Create member by ID route**

```typescript
// src/app/api/v1/families/[familyId]/members/[memberId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateMemberSchema } from "@/lib/validations/family";
import { isUserFamilyManager, isUserFamilyMember } from "@/server/services/family-service";

type Params = { params: Promise<{ familyId: string; memberId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId, memberId } = await params;

    // Get the target member
    const targetMember = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, familyId)))
      .limit(1);

    if (targetMember.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 }
      );
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can edit others, anyone can edit themselves (except role)
    if (!isManager && !isSelf) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Cannot edit this member" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message },
        },
        { status: 400 }
      );
    }

    // Non-managers cannot change roles
    if (parsed.data.role && !isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can change roles" } },
        { status: 403 }
      );
    }

    // Check last manager constraint
    if (parsed.data.role && parsed.data.role !== "manager" && targetMember[0].role === "manager") {
      const managerCount = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "manager")));

      if (managerCount.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "LAST_MANAGER", message: "Cannot demote the last manager" },
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
    if (parsed.data.avatarColor !== undefined) updateData.avatarColor = parsed.data.avatarColor;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;

    await db
      .update(familyMembers)
      .set(updateData)
      .where(eq(familyMembers.id, memberId));

    const updated = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, memberId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { member: updated[0] },
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update member" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId, memberId } = await params;

    // Get the target member
    const targetMember = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.id, memberId), eq(familyMembers.familyId, familyId)))
      .limit(1);

    if (targetMember.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Member not found" } },
        { status: 404 }
      );
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can remove others, anyone can leave (remove themselves)
    if (!isManager && !isSelf) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Cannot remove this member" } },
        { status: 403 }
      );
    }

    // Check last manager constraint
    if (targetMember[0].role === "manager") {
      const managerCount = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.role, "manager")));

      if (managerCount.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "LAST_MANAGER", message: "Cannot remove the last manager. Assign another manager first." },
          },
          { status: 400 }
        );
      }
    }

    await db.delete(familyMembers).where(eq(familyMembers.id, memberId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to remove member" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/members/[memberId]/route.ts
git commit -m "feat(api): add PATCH/DELETE /api/v1/families/[familyId]/members/[memberId] routes"
```

---

## Task 14: API Route - Family Invites

**Files:**
- Create: `src/app/api/v1/families/[familyId]/invites/route.ts`

**Step 1: Create invites route**

```typescript
// src/app/api/v1/families/[familyId]/invites/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyInvites } from "@/server/schema";
import { eq, and, or, gt, isNull } from "drizzle-orm";
import { createInviteSchema } from "@/lib/validations/family";
import { isUserFamilyManager } from "@/server/services/family-service";
import { generateInviteToken, getInviteUrl } from "@/lib/invite-token";

type Params = { params: Promise<{ familyId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can create invites" } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);

    const expiresInDays = parsed.success ? parsed.data.expiresInDays : undefined;
    const maxUses = parsed.success ? parsed.data.maxUses : undefined;

    const inviteId = randomUUID();
    const token = generateInviteToken();
    const now = new Date();
    const expiresAt = expiresInDays
      ? new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await db.insert(familyInvites).values({
      id: inviteId,
      familyId,
      token,
      createdById: session.user.id,
      expiresAt,
      maxUses: maxUses ?? null,
      useCount: 0,
      createdAt: now,
    });

    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const url = getInviteUrl(token, baseUrl);

    return NextResponse.json({
      success: true,
      data: {
        invite: {
          id: inviteId,
          token,
          expiresAt,
          maxUses,
          useCount: 0,
        },
        url,
      },
    });
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create invite" } },
      { status: 500 }
    );
  }
}

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can view invites" } },
        { status: 403 }
      );
    }

    const now = new Date();
    const invites = await db
      .select()
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.familyId, familyId),
          or(isNull(familyInvites.expiresAt), gt(familyInvites.expiresAt, now))
        )
      );

    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const invitesWithUrls = invites.map((invite) => ({
      ...invite,
      url: getInviteUrl(invite.token, baseUrl),
    }));

    return NextResponse.json({
      success: true,
      data: { invites: invitesWithUrls },
    });
  } catch (error) {
    console.error("Error listing invites:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list invites" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/invites/route.ts
git commit -m "feat(api): add POST/GET /api/v1/families/[familyId]/invites routes"
```

---

## Task 15: API Route - Delete Invite

**Files:**
- Create: `src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts`

**Step 1: Create delete invite route**

```typescript
// src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyInvites } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { isUserFamilyManager } from "@/server/services/family-service";

type Params = { params: Promise<{ familyId: string; inviteId: string }> };

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { familyId, inviteId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only managers can revoke invites" } },
        { status: 403 }
      );
    }

    await db
      .delete(familyInvites)
      .where(and(eq(familyInvites.id, inviteId), eq(familyInvites.familyId, familyId)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking invite:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to revoke invite" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify route compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts
git commit -m "feat(api): add DELETE /api/v1/families/[familyId]/invites/[inviteId] route"
```

---

## Task 16: API Route - Validate and Accept Invite

**Files:**
- Create: `src/app/api/v1/invites/[token]/route.ts`

**Step 1: Create invite validation route**

```typescript
// src/app/api/v1/invites/[token]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyInvites, familyMembers } from "@/server/schema";
import { eq, and, or, gt, isNull, lt } from "drizzle-orm";

type Params = { params: Promise<{ token: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const now = new Date();

    const invite = await db
      .select({
        id: familyInvites.id,
        familyId: familyInvites.familyId,
        expiresAt: familyInvites.expiresAt,
        maxUses: familyInvites.maxUses,
        useCount: familyInvites.useCount,
        familyName: families.name,
      })
      .from(familyInvites)
      .innerJoin(families, eq(familyInvites.familyId, families.id))
      .where(eq(familyInvites.token, token))
      .limit(1);

    if (invite.length === 0) {
      return NextResponse.json({
        success: true,
        data: { valid: false, reason: "Invite not found" },
      });
    }

    const inv = invite[0];

    // Check expiration
    if (inv.expiresAt && inv.expiresAt < now) {
      return NextResponse.json({
        success: true,
        data: { valid: false, reason: "Invite has expired" },
      });
    }

    // Check max uses
    if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
      return NextResponse.json({
        success: true,
        data: { valid: false, reason: "Invite has reached maximum uses" },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        familyName: inv.familyName,
        familyId: inv.familyId,
      },
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to validate invite" } },
      { status: 500 }
    );
  }
}
```

**Step 2: Create accept invite route**

```typescript
// src/app/api/v1/invites/[token]/accept/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyInvites, familyMembers } from "@/server/schema";
import { eq, and, sql } from "drizzle-orm";

type Params = { params: Promise<{ token: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { token } = await params;
    const now = new Date();

    // Get and validate invite
    const invite = await db
      .select()
      .from(familyInvites)
      .where(eq(familyInvites.token, token))
      .limit(1);

    if (invite.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INVITE", message: "Invite not found" } },
        { status: 400 }
      );
    }

    const inv = invite[0];

    // Check expiration
    if (inv.expiresAt && inv.expiresAt < now) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED_INVITE", message: "Invite has expired" } },
        { status: 400 }
      );
    }

    // Check max uses
    if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
      return NextResponse.json(
        { success: false, error: { code: "MAX_USES_REACHED", message: "Invite has reached maximum uses" } },
        { status: 400 }
      );
    }

    // Check if already a member
    const existingMembership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, inv.familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "ALREADY_MEMBER", message: "You are already a member of this family" } },
        { status: 400 }
      );
    }

    // Add member
    const memberId = randomUUID();
    await db.insert(familyMembers).values({
      id: memberId,
      familyId: inv.familyId,
      userId: session.user.id,
      role: "participant", // New members join as participants
      createdAt: now,
    });

    // Increment use count
    await db
      .update(familyInvites)
      .set({ useCount: sql`${familyInvites.useCount} + 1` })
      .where(eq(familyInvites.id, inv.id));

    // Get family details
    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, inv.familyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        family: family[0],
        membership: {
          id: memberId,
          familyId: inv.familyId,
          userId: session.user.id,
          role: "participant",
        },
      },
    });
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to accept invite" } },
      { status: 500 }
    );
  }
}
```

**Step 3: Create the accept route file**

Create directory and file: `src/app/api/v1/invites/[token]/accept/route.ts`

**Step 4: Verify routes compile**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/app/api/v1/invites/
git commit -m "feat(api): add invite validation and acceptance routes"
```

---

## Task 17: Update Auth Routes Config

**Files:**
- Modify: `src/lib/auth-routes.ts`

**Step 1: Add family-related routes**

```typescript
// src/lib/auth-routes.ts

export const publicRoutes = ["/", "/login"] as const;
export const loginRoute = "/login";
export const defaultAuthRedirect = "/calendar";
export const onboardingRoute = "/onboarding";

// Routes that allow unauthenticated access for invite links
// (will redirect to login, then back to invite)
export const inviteRoutes = ["/join"] as const;

// Routes that require family membership
export const familyRequiredRoutes = ["/calendar", "/settings"] as const;

export function isPublicRoute(pathname: string): boolean {
  // Remove locale prefix for comparison
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "") || "/";
  return (
    publicRoutes.some((route) => pathWithoutLocale === route) ||
    inviteRoutes.some((route) => pathWithoutLocale.startsWith(route))
  );
}

export function isAuthApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/auth");
}

export function isFamilyRequiredRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "") || "/";
  return familyRequiredRoutes.some((route) => pathWithoutLocale.startsWith(route));
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/auth-routes.ts
git commit -m "feat(auth): add family route configuration"
```

---

## Task 18: Update Middleware for Family Check

**Files:**
- Modify: `src/middleware.ts`

**Step 1: Add family membership check**

Update the middleware to check for family membership on protected routes:

```typescript
// src/middleware.ts

import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import {
  isPublicRoute,
  isAuthApiRoute,
  loginRoute,
  onboardingRoute,
  isFamilyRequiredRoute,
} from "./lib/auth-routes";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API auth routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow API routes through (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // For public routes, just apply i18n
  if (isPublicRoute(pathname)) {
    return intlMiddleware(request);
  }

  // For protected routes, check authentication via cookie
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie?.value) {
    const loginUrl = new URL(loginRoute, request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For family-required routes, check family membership cookie
  if (isFamilyRequiredRoute(pathname)) {
    const hasFamilyCookie = request.cookies.get("has-family");

    if (!hasFamilyCookie?.value) {
      // Redirect to onboarding
      const locale = pathname.match(/^\/(en|nl)/)?.[1] || "nl";
      const onboardingUrl = new URL(`/${locale}${onboardingRoute}`, request.url);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(middleware): add family membership check"
```

---

## Task 19: Family Cookie Utility

**Files:**
- Create: `src/lib/family-cookie.ts`

**Step 1: Create family cookie utility**

```typescript
// src/lib/family-cookie.ts

import { cookies } from "next/headers";

const FAMILY_COOKIE_NAME = "has-family";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function setFamilyCookie() {
  const cookieStore = await cookies();
  cookieStore.set(FAMILY_COOKIE_NAME, "true", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

export async function clearFamilyCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(FAMILY_COOKIE_NAME);
}

export async function hasFamilyCookie(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(FAMILY_COOKIE_NAME)?.value === "true";
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/lib/family-cookie.ts
git commit -m "feat(util): add family cookie management"
```

---

## Task 20: Shared Component - Role Badge

**Files:**
- Create: `src/components/family/role-badge.tsx`

**Step 1: Create role badge component**

```tsx
// src/components/family/role-badge.tsx

import { Badge } from "@/components/ui/badge";
import type { FamilyMemberRole } from "@/types/family";
import { cn } from "@/lib/utils";

interface RoleBadgeProps {
  role: FamilyMemberRole;
  className?: string;
}

const roleConfig: Record<FamilyMemberRole, { label: string; className: string }> = {
  manager: {
    label: "Manager",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  participant: {
    label: "Member",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  caregiver: {
    label: "Caregiver",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/role-badge.tsx
git commit -m "feat(ui): add RoleBadge component"
```

---

## Task 21: Shared Component - Avatar Color Picker

**Files:**
- Create: `src/components/family/avatar-color-picker.tsx`

**Step 1: Create avatar color picker component**

```tsx
// src/components/family/avatar-color-picker.tsx

"use client";

import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";
import { AVATAR_COLORS } from "@/types/family";
import { Check } from "lucide-react";

interface AvatarColorPickerProps {
  value: AvatarColor | null;
  onChange: (color: AvatarColor) => void;
  className?: string;
}

const colorClasses: Record<AvatarColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

export function AvatarColorPicker({
  value,
  onChange,
  className,
}: AvatarColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {AVATAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary",
            colorClasses[color]
          )}
          aria-label={color}
        >
          {value === color && <Check className="h-5 w-5 text-white" />}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/avatar-color-picker.tsx
git commit -m "feat(ui): add AvatarColorPicker component"
```

---

## Task 22: Shared Component - Family Avatar

**Files:**
- Create: `src/components/family/family-avatar.tsx`

**Step 1: Create family avatar component**

```tsx
// src/components/family/family-avatar.tsx

import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";

interface FamilyAvatarProps {
  name: string;
  color?: AvatarColor | string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const colorClasses: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function FamilyAvatar({
  name,
  color = "blue",
  size = "md",
  className,
}: FamilyAvatarProps) {
  const bgClass = color ? colorClasses[color] || "bg-gray-500" : "bg-gray-500";

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-medium text-white",
        bgClass,
        sizeClasses[size],
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/family-avatar.tsx
git commit -m "feat(ui): add FamilyAvatar component"
```

---

## Task 23: Onboarding Layout

**Files:**
- Create: `src/app/[locale]/onboarding/layout.tsx`

**Step 1: Create onboarding layout**

```tsx
// src/app/[locale]/onboarding/layout.tsx

import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

interface OnboardingLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function OnboardingLayout({
  children,
  params,
}: OnboardingLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/onboarding/layout.tsx
git commit -m "feat(onboarding): add onboarding layout"
```

---

## Task 24: Onboarding Entry Page

**Files:**
- Create: `src/app/[locale]/onboarding/page.tsx`

**Step 1: Create onboarding entry page**

```tsx
// src/app/[locale]/onboarding/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Check if user already has a family
  const family = await getUserFamily(session.user.id);

  if (family) {
    // User has a family, redirect to calendar
    redirect(`/${locale}/calendar`);
  }

  // User needs to create/join a family
  redirect(`/${locale}/onboarding/create`);
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/onboarding/page.tsx
git commit -m "feat(onboarding): add onboarding entry page"
```

---

## Task 25: Create Family Form Component

**Files:**
- Create: `src/components/family/onboarding/create-family-form.tsx`

**Step 1: Create the form component**

```tsx
// src/components/family/onboarding/create-family-form.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createFamilySchema, type CreateFamilyInput } from "@/lib/validations/family";
import { Loader2 } from "lucide-react";

interface CreateFamilyFormProps {
  locale: string;
}

export function CreateFamilyForm({ locale }: CreateFamilyFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateFamilyInput>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: {
      name: "",
    },
  });

  async function onSubmit(data: CreateFamilyInput) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/families", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to create family");
        return;
      }

      toast.success("Family created!");
      router.push(`/${locale}/onboarding/invite`);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create Your Family</CardTitle>
        <CardDescription>
          Give your household a name to get started
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Family Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="The Smiths"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Family
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/onboarding/create-family-form.tsx
git commit -m "feat(ui): add CreateFamilyForm component"
```

---

## Task 26: Onboarding Create Page

**Files:**
- Create: `src/app/[locale]/onboarding/create/page.tsx`

**Step 1: Create the create family page**

```tsx
// src/app/[locale]/onboarding/create/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { CreateFamilyForm } from "@/components/family/onboarding/create-family-form";

interface CreatePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CreatePage({ params }: CreatePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Check if user already has a family
  const family = await getUserFamily(session.user.id);

  if (family) {
    redirect(`/${locale}/calendar`);
  }

  return <CreateFamilyForm locale={locale} />;
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/onboarding/create/page.tsx
git commit -m "feat(onboarding): add create family page"
```

---

## Task 27: Invite Members Step Component

**Files:**
- Create: `src/components/family/onboarding/invite-members-step.tsx`

**Step 1: Create the invite step component**

```tsx
// src/components/family/onboarding/invite-members-step.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Copy, Check, Loader2, ArrowRight } from "lucide-react";

interface InviteMembersStepProps {
  familyId: string;
  locale: string;
}

export function InviteMembersStep({ familyId, locale }: InviteMembersStepProps) {
  const router = useRouter();
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  async function generateInvite() {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/families/${familyId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to generate invite");
        return;
      }

      setInviteUrl(result.data.url);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  }

  function continueToCalendar() {
    router.push(`/${locale}/onboarding/complete`);
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Invite Family Members</CardTitle>
        <CardDescription>
          Share an invite link with your family (you can skip this step)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!inviteUrl ? (
          <Button
            onClick={generateInvite}
            disabled={isGenerating}
            className="w-full"
            variant="outline"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Invite Link
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input value={inviteUrl} readOnly className="font-mono text-sm" />
              <Button onClick={copyToClipboard} variant="outline" size="icon">
                {isCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Share this link with family members to invite them
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button onClick={continueToCalendar} className="w-full">
          Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        {!inviteUrl && (
          <Button
            onClick={continueToCalendar}
            variant="ghost"
            className="w-full"
          >
            Skip for now
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/onboarding/invite-members-step.tsx
git commit -m "feat(ui): add InviteMembersStep component"
```

---

## Task 28: Onboarding Invite Page

**Files:**
- Create: `src/app/[locale]/onboarding/invite/page.tsx`

**Step 1: Create the invite page**

```tsx
// src/app/[locale]/onboarding/invite/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { InviteMembersStep } from "@/components/family/onboarding/invite-members-step";

interface InvitePageProps {
  params: Promise<{ locale: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding/create`);
  }

  return <InviteMembersStep familyId={family.id} locale={locale} />;
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/onboarding/invite/page.tsx
git commit -m "feat(onboarding): add invite members page"
```

---

## Task 29: Onboarding Complete Page

**Files:**
- Create: `src/app/[locale]/onboarding/complete/page.tsx`

**Step 1: Create the complete page**

```tsx
// src/app/[locale]/onboarding/complete/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { setFamilyCookie } from "@/lib/family-cookie";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface CompletePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding/create`);
  }

  // Set the family cookie so middleware allows access to protected routes
  await setFamilyCookie();

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">All Set!</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">
          Your family &ldquo;{family.name}&rdquo; is ready to go.
        </p>
        <Button asChild className="w-full">
          <Link href={`/${locale}/calendar`}>Go to Calendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/onboarding/complete/page.tsx
git commit -m "feat(onboarding): add complete page with cookie setup"
```

---

## Task 30: Join Family Page

**Files:**
- Create: `src/app/[locale]/join/[token]/page.tsx`

**Step 1: Create the join family page**

```tsx
// src/app/[locale]/join/[token]/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { JoinFamilyClient } from "@/components/family/join-family-client";

interface JoinPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export default async function JoinPage({ params }: JoinPageProps) {
  const { locale, token } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    // Redirect to login with callback to this page
    redirect(`/${locale}/login?callbackUrl=/${locale}/join/${token}`);
  }

  return <JoinFamilyClient token={token} locale={locale} />;
}
```

**Step 2: Create the join client component**

```tsx
// src/components/family/join-family-client.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, AlertCircle, Users } from "lucide-react";

interface JoinFamilyClientProps {
  token: string;
  locale: string;
}

interface InviteValidation {
  valid: boolean;
  familyName?: string;
  familyId?: string;
  reason?: string;
}

export function JoinFamilyClient({ token, locale }: JoinFamilyClientProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [validation, setValidation] = useState<InviteValidation | null>(null);

  useEffect(() => {
    async function validateInvite() {
      try {
        const response = await fetch(`/api/v1/invites/${token}`);
        const result = await response.json();

        if (result.success) {
          setValidation(result.data);
        } else {
          setValidation({ valid: false, reason: result.error?.message });
        }
      } catch (error) {
        setValidation({ valid: false, reason: "Failed to validate invite" });
      } finally {
        setIsLoading(false);
      }
    }

    validateInvite();
  }, [token]);

  async function handleJoin() {
    setIsJoining(true);

    try {
      const response = await fetch(`/api/v1/invites/${token}/accept`, {
        method: "POST",
      });

      const result = await response.json();

      if (!result.success) {
        if (result.error?.code === "ALREADY_MEMBER") {
          toast.info("You are already a member of this family");
          router.push(`/${locale}/calendar`);
          return;
        }
        toast.error(result.error?.message || "Failed to join family");
        return;
      }

      toast.success(`Welcome to ${result.data.family.name}!`);
      router.push(`/${locale}/onboarding/complete`);
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsJoining(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!validation?.valid) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
            <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">Invalid Invite</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            {validation?.reason || "This invite link is not valid"}
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push(`/${locale}/onboarding`)}
          >
            Create Your Own Family
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
          <Users className="h-10 w-10 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle className="text-2xl">Join Family</CardTitle>
        <CardDescription>
          You&apos;ve been invited to join
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-xl font-semibold">{validation.familyName}</p>
      </CardContent>
      <CardFooter>
        <Button onClick={handleJoin} disabled={isJoining} className="w-full">
          {isJoining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Join Family
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**Step 3: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/app/[locale]/join/[token]/page.tsx src/components/family/join-family-client.tsx
git commit -m "feat(join): add join family page and client component"
```

---

## Task 31: Family Settings Page

**Files:**
- Create: `src/app/[locale]/settings/family/page.tsx`

**Step 1: Create the family settings page**

```tsx
// src/app/[locale]/settings/family/page.tsx

import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily, getFamilyMembers } from "@/server/services/family-service";
import { FamilySettingsClient } from "@/components/family/family-settings-client";

interface FamilySettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FamilySettingsPage({
  params,
}: FamilySettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding`);
  }

  const members = await getFamilyMembers(family.id);

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Family Settings</h1>
          <p className="text-muted-foreground">
            Manage your family and members
          </p>
        </div>
        <FamilySettingsClient
          family={family}
          members={members}
          currentUserId={session.user.id}
          isManager={family.currentUserRole === "manager"}
          locale={locale}
        />
      </div>
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/[locale]/settings/family/page.tsx
git commit -m "feat(settings): add family settings page"
```

---

## Task 32: Family Settings Client Component

**Files:**
- Create: `src/components/family/family-settings-client.tsx`

**Step 1: Create the family settings client component**

```tsx
// src/components/family/family-settings-client.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Family, FamilyMember } from "@/server/schema";
import type { FamilyMemberWithUser, FamilyMemberRole } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FamilyMemberCard } from "./family-member-card";
import { InviteLinkGenerator } from "./invite-link-generator";
import { Pencil, Save, X, Loader2 } from "lucide-react";

interface FamilySettingsClientProps {
  family: Family & { currentUserRole: FamilyMemberRole };
  members: FamilyMemberWithUser[];
  currentUserId: string;
  isManager: boolean;
  locale: string;
}

export function FamilySettingsClient({
  family,
  members: initialMembers,
  currentUserId,
  isManager,
  locale,
}: FamilySettingsClientProps) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [isEditingName, setIsEditingName] = useState(false);
  const [familyName, setFamilyName] = useState(family.name);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveName() {
    if (!familyName.trim()) {
      toast.error("Family name cannot be empty");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/v1/families/${family.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: familyName }),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to update name");
        return;
      }

      toast.success("Family name updated");
      setIsEditingName(false);
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${memberId}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to remove member");
        return;
      }

      setMembers(members.filter((m) => m.id !== memberId));
      toast.success("Member removed");
    } catch (error) {
      toast.error("Something went wrong");
    }
  }

  async function handleLeaveFamily() {
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember) return;

    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${currentMember.id}`,
        { method: "DELETE" }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to leave family");
        return;
      }

      toast.success("You have left the family");
      router.push(`/${locale}/onboarding`);
    } catch (error) {
      toast.error("Something went wrong");
    }
  }

  async function handleMemberUpdate(
    memberId: string,
    data: Partial<FamilyMember>
  ) {
    try {
      const response = await fetch(
        `/api/v1/families/${family.id}/members/${memberId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to update member");
        return;
      }

      setMembers(
        members.map((m) =>
          m.id === memberId ? { ...m, ...result.data.member } : m
        )
      );
      toast.success("Member updated");
    } catch (error) {
      toast.error("Something went wrong");
    }
  }

  return (
    <div className="space-y-6">
      {/* Family Details */}
      <Card>
        <CardHeader>
          <CardTitle>Family Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <>
                <Input
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setFamilyName(family.name);
                    setIsEditingName(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-lg font-medium">{family.name}</span>
                {isManager && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Created {new Date(family.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle>Members ({members.length})</CardTitle>
          <CardDescription>Manage your family members</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => (
            <FamilyMemberCard
              key={member.id}
              member={member}
              isCurrentUser={member.userId === currentUserId}
              canEdit={isManager || member.userId === currentUserId}
              canRemove={isManager && member.userId !== currentUserId}
              canChangeRole={isManager}
              onUpdate={(data) => handleMemberUpdate(member.id, data)}
              onRemove={() => handleRemoveMember(member.id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Invite */}
      {isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Invite Members</CardTitle>
            <CardDescription>
              Generate a link to invite new members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteLinkGenerator familyId={family.id} />
          </CardContent>
        </Card>
      )}

      {/* Leave Family */}
      <Card>
        <CardHeader>
          <CardTitle>Leave Family</CardTitle>
          <CardDescription>
            Remove yourself from this family
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Leave Family</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Leave Family?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to leave &ldquo;{family.name}&rdquo;?
                  You will need a new invite to rejoin.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveFamily}>
                  Leave
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/family-settings-client.tsx
git commit -m "feat(ui): add FamilySettingsClient component"
```

---

## Task 33: Family Member Card Component

**Files:**
- Create: `src/components/family/family-member-card.tsx`

**Step 1: Create the member card component**

```tsx
// src/components/family/family-member-card.tsx

"use client";

import { useState } from "react";
import type { FamilyMemberWithUser, FamilyMemberRole, AvatarColor } from "@/types/family";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RoleBadge } from "./role-badge";
import { FamilyAvatar } from "./family-avatar";
import { MemberEditDialog } from "./member-edit-dialog";
import { Pencil, Trash2 } from "lucide-react";

interface FamilyMemberCardProps {
  member: FamilyMemberWithUser;
  isCurrentUser: boolean;
  canEdit: boolean;
  canRemove: boolean;
  canChangeRole: boolean;
  onUpdate: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    role?: FamilyMemberRole;
  }) => void;
  onRemove: () => void;
}

export function FamilyMemberCard({
  member,
  isCurrentUser,
  canEdit,
  canRemove,
  canChangeRole,
  onUpdate,
  onRemove,
}: FamilyMemberCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const displayName = member.displayName || member.user.name;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border">
      <div className="flex items-center gap-3">
        <FamilyAvatar
          name={displayName}
          color={member.avatarColor as AvatarColor}
        />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
            {isCurrentUser && (
              <span className="text-xs text-muted-foreground">(you)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {member.user.email}
            </span>
            <RoleBadge role={member.role as FamilyMemberRole} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {canEdit && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}

        {canRemove && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove {displayName} from the family?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRemove}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <MemberEditDialog
        member={member}
        canChangeRole={canChangeRole}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={onUpdate}
      />
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/family-member-card.tsx
git commit -m "feat(ui): add FamilyMemberCard component"
```

---

## Task 34: Member Edit Dialog Component

**Files:**
- Create: `src/components/family/member-edit-dialog.tsx`

**Step 1: Create the member edit dialog component**

```tsx
// src/components/family/member-edit-dialog.tsx

"use client";

import { useState } from "react";
import type { FamilyMemberWithUser, FamilyMemberRole, AvatarColor } from "@/types/family";
import { FAMILY_MEMBER_ROLES } from "@/types/family";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvatarColorPicker } from "./avatar-color-picker";

interface MemberEditDialogProps {
  member: FamilyMemberWithUser;
  canChangeRole: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    displayName?: string | null;
    avatarColor?: AvatarColor | null;
    role?: FamilyMemberRole;
  }) => void;
}

const roleLabels: Record<FamilyMemberRole, string> = {
  manager: "Manager",
  participant: "Member",
  caregiver: "Caregiver",
};

export function MemberEditDialog({
  member,
  canChangeRole,
  open,
  onOpenChange,
  onSave,
}: MemberEditDialogProps) {
  const [displayName, setDisplayName] = useState(member.displayName || "");
  const [avatarColor, setAvatarColor] = useState<AvatarColor | null>(
    (member.avatarColor as AvatarColor) || null
  );
  const [role, setRole] = useState<FamilyMemberRole>(
    member.role as FamilyMemberRole
  );

  function handleSave() {
    onSave({
      displayName: displayName || null,
      avatarColor,
      ...(canChangeRole && { role }),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update display name and appearance
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={member.user.name}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to use account name
            </p>
          </div>

          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <AvatarColorPicker value={avatarColor} onChange={setAvatarColor} />
          </div>

          {canChangeRole && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as FamilyMemberRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAMILY_MEMBER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {roleLabels[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/member-edit-dialog.tsx
git commit -m "feat(ui): add MemberEditDialog component"
```

---

## Task 35: Invite Link Generator Component

**Files:**
- Create: `src/components/family/invite-link-generator.tsx`

**Step 1: Create the invite link generator component**

```tsx
// src/components/family/invite-link-generator.tsx

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Loader2, RefreshCw } from "lucide-react";

interface InviteLinkGeneratorProps {
  familyId: string;
}

export function InviteLinkGenerator({ familyId }: InviteLinkGeneratorProps) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  async function generateInvite() {
    setIsGenerating(true);

    try {
      const response = await fetch(`/api/v1/families/${familyId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const result = await response.json();

      if (!result.success) {
        toast.error(result.error?.message || "Failed to generate invite");
        return;
      }

      setInviteUrl(result.data.url);
      toast.success("Invite link generated");
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  }

  if (!inviteUrl) {
    return (
      <Button onClick={generateInvite} disabled={isGenerating}>
        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generate Invite Link
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={inviteUrl} readOnly className="font-mono text-sm" />
        <Button onClick={copyToClipboard} variant="outline" size="icon">
          {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
        <Button
          onClick={generateInvite}
          variant="outline"
          size="icon"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Share this link with family members to invite them
      </p>
    </div>
  );
}
```

**Step 2: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/family/invite-link-generator.tsx
git commit -m "feat(ui): add InviteLinkGenerator component"
```

---

## Task 36: Add Translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add the following to `messages/en.json`:

```json
{
  "Family": {
    "title": "Family",
    "familyName": "Family Name",
    "familySettings": "Family Settings",
    "members": "Members",
    "leaveFamily": "Leave Family"
  },
  "FamilyRoles": {
    "manager": "Manager",
    "participant": "Member",
    "caregiver": "Caregiver"
  },
  "FamilyOnboarding": {
    "createTitle": "Create Your Family",
    "createDescription": "Give your household a name to get started",
    "inviteTitle": "Invite Family Members",
    "inviteDescription": "Share an invite link with your family (you can skip this)",
    "completeTitle": "All Set!",
    "completeDescription": "Your family is ready to go"
  }
}
```

**Step 2: Add Dutch translations**

Add the following to `messages/nl.json`:

```json
{
  "Family": {
    "title": "Familie",
    "familyName": "Familienaam",
    "familySettings": "Familie-instellingen",
    "members": "Leden",
    "leaveFamily": "Familie verlaten"
  },
  "FamilyRoles": {
    "manager": "Beheerder",
    "participant": "Lid",
    "caregiver": "Verzorger"
  },
  "FamilyOnboarding": {
    "createTitle": "Maak je familie aan",
    "createDescription": "Geef je huishouden een naam om te beginnen",
    "inviteTitle": "Nodig familieleden uit",
    "inviteDescription": "Deel een uitnodigingslink met je familie (je kunt dit overslaan)",
    "completeTitle": "Klaar!",
    "completeDescription": "Je familie is klaar voor gebruik"
  }
}
```

**Step 3: Verify translations work**

Run: `pnpm dev`
Expected: No errors, app runs

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add family translations"
```

---

## Task 37: Add Family Settings to User Menu

**Files:**
- Modify: `src/components/auth/user-menu.tsx`

**Step 1: Add family settings link to user menu**

Add a link to family settings in the user menu dropdown:

```tsx
// In the DropdownMenuContent, add before the sign out item:
<DropdownMenuItem asChild>
  <Link href={`/${locale}/settings/family`}>
    <Users className="mr-2 h-4 w-4" />
    Family Settings
  </Link>
</DropdownMenuItem>
```

**Step 2: Add Users import**

```tsx
import { Users } from "lucide-react";
```

**Step 3: Verify compiles**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/auth/user-menu.tsx
git commit -m "feat(nav): add family settings link to user menu"
```

---

## Task 38: Final Verification

**Step 1: Run full build**

Run: `pnpm build`
Expected: Build succeeds with no errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No linting errors

**Step 3: Start dev server and test flows**

Run: `pnpm dev`
Expected: Server starts successfully

**Step 4: Manual testing checklist**

- [ ] New user is redirected to /onboarding
- [ ] Can create a family
- [ ] Can generate invite link
- [ ] Can complete onboarding and access calendar
- [ ] Invite link works for another user
- [ ] Family settings page shows members
- [ ] Can edit own profile
- [ ] Manager can edit others and change roles
- [ ] Can leave family

**Step 5: Commit final state**

```bash
git add .
git commit -m "feat: complete families feature implementation"
```

---

## Summary

This plan implements the Families feature in 38 bite-sized tasks following TDD principles. Each task is atomic and can be committed independently. The implementation covers:

1. **Database** (Tasks 1-5): Schema for families, members, invites with relations
2. **Types & Utils** (Tasks 6-8): TypeScript types, Zod schemas, token generator
3. **Services** (Task 9): Family service with query helpers
4. **API Routes** (Tasks 10-16): Full CRUD for families, members, invites
5. **Middleware** (Tasks 17-19): Route protection and cookie management
6. **Shared Components** (Tasks 20-22): RoleBadge, AvatarColorPicker, FamilyAvatar
7. **Onboarding Flow** (Tasks 23-29): Layout, create, invite, complete pages
8. **Join Flow** (Task 30): Join family via invite link
9. **Settings** (Tasks 31-35): Family management UI
10. **Polish** (Tasks 36-38): Translations, navigation, testing
