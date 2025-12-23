# Star Service Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a centralized star service that tracks all star transactions (earning/spending) with full audit trail, replacing the current per-chart goal accumulation.

**Architecture:** The star service is a new service layer module that all star-generating features (reward chart, chores, bonuses) call to record transactions. It maintains an append-only ledger and caches balances for fast reads.

**Tech Stack:** Drizzle ORM, PostgreSQL, Zod validation, Vitest for testing

---

## Phase 1: Database Schema

### Task 1.1: Add star_transactions table to schema

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add the star_transactions table**

Add after the Chores section (around line 243):

```typescript
// ============================================================================
// Star Transactions
// ============================================================================

/**
 * Star Transactions table - Central ledger for all star activity
 */
export const starTransactions = pgTable("star_transactions", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'reward_chart' | 'chore' | 'bonus' | 'redemption'
  referenceId: text("reference_id"), // FK to source (taskId, choreId, rewardId)
  description: text("description").notNull(),
  awardedById: text("awarded_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add member_star_balances table**

Add immediately after star_transactions:

```typescript
/**
 * Member Star Balances table - Cached balance for fast reads
 */
export const memberStarBalances = pgTable("member_star_balances", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 3: Add member_primary_goals table**

Add immediately after member_star_balances:

```typescript
/**
 * Member Primary Goals table - Tracks each child's current goal
 */
export const memberPrimaryGoals = pgTable("member_primary_goals", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  rewardId: text("reward_id").notNull(), // FK to rewards table (future)
  setAt: timestamp("set_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 4: Add relations for star tables**

Add after the existing relations:

```typescript
export const starTransactionsRelations = relations(
  starTransactions,
  ({ one }) => ({
    family: one(families, {
      fields: [starTransactions.familyId],
      references: [families.id],
    }),
    member: one(familyMembers, {
      fields: [starTransactions.memberId],
      references: [familyMembers.id],
    }),
    awardedBy: one(familyMembers, {
      fields: [starTransactions.awardedById],
      references: [familyMembers.id],
    }),
  })
);

export const memberStarBalancesRelations = relations(
  memberStarBalances,
  ({ one }) => ({
    member: one(familyMembers, {
      fields: [memberStarBalances.memberId],
      references: [familyMembers.id],
    }),
  })
);

export const memberPrimaryGoalsRelations = relations(
  memberPrimaryGoals,
  ({ one }) => ({
    member: one(familyMembers, {
      fields: [memberPrimaryGoals.memberId],
      references: [familyMembers.id],
    }),
  })
);
```

**Step 5: Add type exports**

Add at the end of the Type Exports section:

```typescript
export type StarTransaction = typeof starTransactions.$inferSelect;
export type NewStarTransaction = typeof starTransactions.$inferInsert;
export type MemberStarBalance = typeof memberStarBalances.$inferSelect;
export type NewMemberStarBalance = typeof memberStarBalances.$inferInsert;
export type MemberPrimaryGoal = typeof memberPrimaryGoals.$inferSelect;
export type NewMemberPrimaryGoal = typeof memberPrimaryGoals.$inferInsert;
```

**Step 6: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 7: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(schema): add star transactions tables"
```

---

### Task 1.2: Generate and run migration

**Files:**

- Create: `drizzle/XXXX_add_star_transactions.sql` (auto-generated)

**Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created in `drizzle/` directory

**Step 2: Run migration**

Run: `pnpm db:push`
Expected: Tables created successfully

**Step 3: Commit migration**

```bash
git add drizzle/
git commit -m "chore(db): add star transactions migration"
```

---

## Phase 2: Validation Schemas

### Task 2.1: Create star validation schemas

**Files:**

- Create: `src/lib/validations/star.ts`

**Step 1: Create the validation file**

```typescript
import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const starTransactionTypeSchema = z.enum([
  "reward_chart",
  "chore",
  "bonus",
  "redemption",
]);
export type StarTransactionType = z.infer<typeof starTransactionTypeSchema>;

// =============================================================================
// ADD STARS
// =============================================================================

export const addStarsSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  amount: z.number().int().min(1, "Amount must be at least 1"),
  type: z.enum(["reward_chart", "chore", "bonus"]),
  referenceId: z.string().optional(),
  description: z.string().min(1, "Description is required").max(200),
  awardedById: z.string().optional(),
});

export type AddStarsInput = z.infer<typeof addStarsSchema>;

// =============================================================================
// REMOVE STARS
// =============================================================================

export const removeStarsSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
  amount: z.number().int().min(1, "Amount must be at least 1"),
  type: z.literal("redemption"),
  referenceId: z.string().min(1, "Reference ID is required"),
  description: z.string().min(1, "Description is required").max(200),
});

export type RemoveStarsInput = z.infer<typeof removeStarsSchema>;

// =============================================================================
// HISTORY QUERY
// =============================================================================

export const starHistoryQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
  type: starTransactionTypeSchema.optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type StarHistoryQueryInput = z.infer<typeof starHistoryQuerySchema>;

// =============================================================================
// BONUS STARS (API input)
// =============================================================================

export const grantBonusStarsSchema = z.object({
  amount: z.number().int().min(1).max(100, "Max 100 stars per bonus"),
  description: z.string().min(1, "Reason is required").max(200),
});

export type GrantBonusStarsInput = z.infer<typeof grantBonusStarsSchema>;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validations/star.ts
git commit -m "feat(validation): add star transaction schemas"
```

---

## Phase 3: Star Service Core

### Task 3.1: Write failing test for getBalance

**Files:**

- Create: `src/server/services/__tests__/star-service.test.ts`

**Step 1: Create test file with first test**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe("star-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBalance", () => {
    it("returns 0 when no balance record exists", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as never);

      const { getBalance } = await import("../star-service");
      const balance = await getBalance("member-123");

      expect(balance).toBe(0);
    });

    it("returns cached balance when record exists", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ balance: 42 }]),
        }),
      } as never);

      const { getBalance } = await import("../star-service");
      const balance = await getBalance("member-123");

      expect(balance).toBe(42);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: FAIL - "Cannot find module '../star-service'"

**Step 3: Commit failing test**

```bash
git add src/server/services/__tests__/star-service.test.ts
git commit -m "test(star-service): add failing getBalance tests"
```

---

### Task 3.2: Implement getBalance

**Files:**

- Create: `src/server/services/star-service.ts`

**Step 1: Create service with getBalance**

```typescript
import { db } from "@/server/db";
import { starTransactions, memberStarBalances } from "@/server/schema";
import { eq } from "drizzle-orm";

// =============================================================================
// BALANCE OPERATIONS
// =============================================================================

/**
 * Get the current star balance for a member
 */
export async function getBalance(memberId: string): Promise<number> {
  const results = await db
    .select()
    .from(memberStarBalances)
    .where(eq(memberStarBalances.memberId, memberId));

  return results[0]?.balance ?? 0;
}
```

**Step 2: Run test to verify it passes**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/star-service.ts
git commit -m "feat(star-service): implement getBalance"
```

---

### Task 3.3: Write failing test for addStars

**Files:**

- Modify: `src/server/services/__tests__/star-service.test.ts`

**Step 1: Add addStars tests**

Add after the getBalance describe block:

```typescript
describe("addStars", () => {
  it("creates transaction and updates balance", async () => {
    const { db } = await import("@/server/db");

    // Mock transaction to execute callback
    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "txn-1",
                memberId: "member-123",
                amount: 5,
                type: "reward_chart",
                description: "Brushed teeth",
                createdAt: new Date(),
              },
            ]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ balance: 10 }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as never);
    });

    const { addStars } = await import("../star-service");
    const result = await addStars({
      memberId: "member-123",
      amount: 5,
      type: "reward_chart",
      referenceId: "task-1",
      description: "Brushed teeth",
    });

    expect(result.transaction.amount).toBe(5);
    expect(result.newBalance).toBe(15);
  });

  it("throws when amount is negative", async () => {
    const { addStars } = await import("../star-service");

    await expect(
      addStars({
        memberId: "member-123",
        amount: -5,
        type: "bonus",
        description: "Invalid",
      })
    ).rejects.toThrow("Amount must be positive");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: FAIL - addStars is not a function

**Step 3: Commit**

```bash
git add src/server/services/__tests__/star-service.test.ts
git commit -m "test(star-service): add failing addStars tests"
```

---

### Task 3.4: Implement addStars

**Files:**

- Modify: `src/server/services/star-service.ts`

**Step 1: Add imports and addStars function**

Update the file:

```typescript
import { db } from "@/server/db";
import {
  starTransactions,
  memberStarBalances,
  familyMembers,
} from "@/server/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { AddStarsInput } from "@/lib/validations/star";
import type { StarTransaction } from "@/server/schema";

// =============================================================================
// BALANCE OPERATIONS
// =============================================================================

/**
 * Get the current star balance for a member
 */
export async function getBalance(memberId: string): Promise<number> {
  const results = await db
    .select()
    .from(memberStarBalances)
    .where(eq(memberStarBalances.memberId, memberId));

  return results[0]?.balance ?? 0;
}

// =============================================================================
// TRANSACTION OPERATIONS
// =============================================================================

/**
 * Add stars to a member's balance (earning)
 */
export async function addStars(
  input: AddStarsInput
): Promise<{ transaction: StarTransaction; newBalance: number }> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Get family ID for the member
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, input.memberId));

  if (members.length === 0) {
    throw new Error("Member not found");
  }

  const familyId = members[0].familyId;

  return await db.transaction(async (tx) => {
    // Create transaction record
    const [transaction] = await tx
      .insert(starTransactions)
      .values({
        id: createId(),
        familyId,
        memberId: input.memberId,
        amount: input.amount,
        type: input.type,
        referenceId: input.referenceId ?? null,
        description: input.description,
        awardedById: input.awardedById ?? null,
        createdAt: new Date(),
      })
      .returning();

    // Get current balance
    const balanceRecords = await tx
      .select()
      .from(memberStarBalances)
      .where(eq(memberStarBalances.memberId, input.memberId));

    const currentBalance = balanceRecords[0]?.balance ?? 0;
    const newBalance = currentBalance + input.amount;

    // Upsert balance
    if (balanceRecords.length === 0) {
      await tx.insert(memberStarBalances).values({
        memberId: input.memberId,
        balance: newBalance,
        updatedAt: new Date(),
      });
    } else {
      await tx
        .update(memberStarBalances)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(memberStarBalances.memberId, input.memberId));
    }

    return { transaction, newBalance };
  });
}
```

**Step 2: Run test to verify it passes**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/star-service.ts
git commit -m "feat(star-service): implement addStars"
```

---

### Task 3.5: Write failing test for removeStars

**Files:**

- Modify: `src/server/services/__tests__/star-service.test.ts`

**Step 1: Add removeStars tests**

```typescript
describe("removeStars", () => {
  it("creates negative transaction and updates balance", async () => {
    const { db } = await import("@/server/db");

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "txn-2",
                memberId: "member-123",
                amount: -50,
                type: "redemption",
                description: "Movie Night",
                createdAt: new Date(),
              },
            ]),
          }),
        }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ balance: 100 }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      } as never);
    });

    const { removeStars } = await import("../star-service");
    const result = await removeStars({
      memberId: "member-123",
      amount: 50,
      type: "redemption",
      referenceId: "reward-1",
      description: "Movie Night",
    });

    expect(result.transaction.amount).toBe(-50);
    expect(result.newBalance).toBe(50);
  });

  it("throws InsufficientStarsError when balance too low", async () => {
    const { db } = await import("@/server/db");

    vi.mocked(db.transaction).mockImplementation(async (callback) => {
      return callback({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ balance: 10 }]),
          }),
        }),
      } as never);
    });

    const { removeStars, InsufficientStarsError } =
      await import("../star-service");

    await expect(
      removeStars({
        memberId: "member-123",
        amount: 50,
        type: "redemption",
        referenceId: "reward-1",
        description: "Movie Night",
      })
    ).rejects.toBeInstanceOf(InsufficientStarsError);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: FAIL - removeStars is not a function

**Step 3: Commit**

```bash
git add src/server/services/__tests__/star-service.test.ts
git commit -m "test(star-service): add failing removeStars tests"
```

---

### Task 3.6: Implement removeStars

**Files:**

- Modify: `src/server/services/star-service.ts`

**Step 1: Add InsufficientStarsError and removeStars**

Add after addStars:

```typescript
// =============================================================================
// ERRORS
// =============================================================================

export class InsufficientStarsError extends Error {
  constructor(
    public balance: number,
    public required: number
  ) {
    super(`Insufficient stars: have ${balance}, need ${required}`);
    this.name = "InsufficientStarsError";
  }
}

// =============================================================================
// REMOVE STARS
// =============================================================================

/**
 * Remove stars from a member's balance (spending)
 */
export async function removeStars(input: {
  memberId: string;
  amount: number;
  type: "redemption";
  referenceId: string;
  description: string;
}): Promise<{ transaction: StarTransaction; newBalance: number }> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Get family ID for the member
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, input.memberId));

  if (members.length === 0) {
    throw new Error("Member not found");
  }

  const familyId = members[0].familyId;

  return await db.transaction(async (tx) => {
    // Get current balance
    const balanceRecords = await tx
      .select()
      .from(memberStarBalances)
      .where(eq(memberStarBalances.memberId, input.memberId));

    const currentBalance = balanceRecords[0]?.balance ?? 0;

    if (currentBalance < input.amount) {
      throw new InsufficientStarsError(currentBalance, input.amount);
    }

    const newBalance = currentBalance - input.amount;

    // Create transaction record (negative amount)
    const [transaction] = await tx
      .insert(starTransactions)
      .values({
        id: createId(),
        familyId,
        memberId: input.memberId,
        amount: -input.amount,
        type: input.type,
        referenceId: input.referenceId,
        description: input.description,
        awardedById: null,
        createdAt: new Date(),
      })
      .returning();

    // Update balance
    await tx
      .update(memberStarBalances)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(memberStarBalances.memberId, input.memberId));

    return { transaction, newBalance };
  });
}
```

**Step 2: Run tests**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/star-service.ts
git commit -m "feat(star-service): implement removeStars with InsufficientStarsError"
```

---

### Task 3.7: Implement getHistory

**Files:**

- Modify: `src/server/services/__tests__/star-service.test.ts`
- Modify: `src/server/services/star-service.ts`

**Step 1: Add test for getHistory**

```typescript
describe("getHistory", () => {
  it("returns transactions for member with filters", async () => {
    const { db } = await import("@/server/db");
    const mockTransactions = [
      {
        id: "txn-1",
        amount: 5,
        type: "reward_chart",
        description: "Brushed teeth",
        createdAt: new Date(),
      },
      {
        id: "txn-2",
        amount: -50,
        type: "redemption",
        description: "Movie Night",
        createdAt: new Date(),
      },
    ];

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(mockTransactions),
            }),
          }),
        }),
      }),
    } as never);

    const { getHistory } = await import("../star-service");
    const history = await getHistory("member-123", { limit: 10 });

    expect(history).toHaveLength(2);
    expect(history[0].type).toBe("reward_chart");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: FAIL

**Step 3: Implement getHistory**

Add to star-service.ts:

```typescript
import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { StarHistoryQueryInput } from "@/lib/validations/star";

/**
 * Get transaction history for a member
 */
export async function getHistory(
  memberId: string,
  options?: StarHistoryQueryInput
): Promise<StarTransaction[]> {
  const conditions = [eq(starTransactions.memberId, memberId)];

  if (options?.type) {
    conditions.push(eq(starTransactions.type, options.type));
  }

  if (options?.startDate) {
    conditions.push(
      gte(starTransactions.createdAt, new Date(options.startDate))
    );
  }

  if (options?.endDate) {
    const endOfDay = new Date(options.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(starTransactions.createdAt, endOfDay));
  }

  return await db
    .select()
    .from(starTransactions)
    .where(and(...conditions))
    .orderBy(desc(starTransactions.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}
```

**Step 4: Run tests**

Run: `pnpm test:run src/server/services/__tests__/star-service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/star-service.ts src/server/services/__tests__/star-service.test.ts
git commit -m "feat(star-service): implement getHistory with filters"
```

---

## Phase 4: API Routes

### Task 4.1: Create balance API route

**Files:**

- Create: `src/app/api/v1/families/[familyId]/members/[memberId]/stars/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBalance, getHistory } from "@/server/services/star-service";
import { starHistoryQuerySchema } from "@/lib/validations/star";
import { auth } from "@/server/auth";
import { headers } from "next/headers";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/members/[memberId]/stars
 * Get star balance and optionally history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memberId } = await params;
    const { searchParams } = new URL(request.url);

    const balance = await getBalance(memberId);

    // If history requested
    if (searchParams.get("includeHistory") === "true") {
      const queryResult = starHistoryQuerySchema.safeParse({
        limit: searchParams.get("limit")
          ? parseInt(searchParams.get("limit")!)
          : undefined,
        offset: searchParams.get("offset")
          ? parseInt(searchParams.get("offset")!)
          : undefined,
        type: searchParams.get("type") ?? undefined,
      });

      if (!queryResult.success) {
        return NextResponse.json(
          { error: "Invalid query parameters" },
          { status: 400 }
        );
      }

      const history = await getHistory(memberId, queryResult.data);
      return NextResponse.json({ balance, history });
    }

    return NextResponse.json({ balance });
  } catch (error) {
    console.error("Error fetching star balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch star balance" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/members/\[memberId\]/stars/route.ts
git commit -m "feat(api): add GET /members/:id/stars endpoint"
```

---

### Task 4.2: Create bonus stars API route

**Files:**

- Create: `src/app/api/v1/families/[familyId]/members/[memberId]/stars/bonus/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { addStars } from "@/server/services/star-service";
import { grantBonusStarsSchema } from "@/lib/validations/star";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * POST /api/v1/families/[familyId]/members/[memberId]/stars/bonus
 * Award bonus stars to a family member (managers only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, memberId } = await params;

    // Verify caller is a manager in this family
    const callerMembership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (
      callerMembership.length === 0 ||
      callerMembership[0].role !== "manager"
    ) {
      return NextResponse.json(
        { error: "Only managers can award bonus stars" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = grantBonusStarsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const result = await addStars({
      memberId,
      amount: parseResult.data.amount,
      type: "bonus",
      description: parseResult.data.description,
      awardedById: callerMembership[0].id,
    });

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error awarding bonus stars:", error);
    return NextResponse.json(
      { error: "Failed to award bonus stars" },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/members/\[memberId\]/stars/bonus/route.ts
git commit -m "feat(api): add POST /members/:id/stars/bonus endpoint"
```

---

## Phase 5: Integration with Reward Chart

### Task 5.1: Update reward-chart-service to use star-service

**Files:**

- Modify: `src/server/services/reward-chart-service.ts`

**Step 1: Import star service**

Add at the top of the file:

```typescript
import { addStars, removeStars } from "@/server/services/star-service";
```

**Step 2: Update completeTask function**

Replace the goal update logic (lines ~336-372) with:

```typescript
// Add stars to central balance
await starService.addStars({
  memberId: chart.memberId,
  amount: task.starValue,
  type: "reward_chart",
  referenceId: taskId,
  description: task.title,
});

// Note: Goal progress now comes from star balance, not starsCurrent
// This will be updated in UI to use starService.getBalance()
```

**Step 3: Update undoCompletion function**

Replace the goal update logic with:

```typescript
// Remove stars from central balance (creates negative transaction)
await starService.addStars({
  memberId: chart.memberId,
  amount: -task.starValue, // Negative to reverse
  type: "reward_chart",
  referenceId: taskId,
  description: `Undo: ${task.title}`,
});
```

**Step 4: Run existing tests**

Run: `pnpm test:run`
Expected: All tests pass (may need mock updates)

**Step 5: Commit**

```bash
git add src/server/services/reward-chart-service.ts
git commit -m "feat(reward-chart): integrate with star-service for completions"
```

---

### Task 5.2: Update chore-service to use star-service

**Files:**

- Modify: `src/server/services/chore-service.ts`

**Step 1: Import star service**

Add at the top:

```typescript
import { addStars } from "@/server/services/star-service";
```

**Step 2: Update completeChore function**

Add after the status update (around line 265):

```typescript
// Award stars for completing chore
if (existing.starReward > 0 && completedById) {
  await addStars({
    memberId: completedById,
    amount: existing.starReward,
    type: "chore",
    referenceId: choreId,
    description: existing.title,
  });
}
```

**Step 3: Update undoChoreCompletion function**

Add reversal logic:

```typescript
// Remove stars that were awarded (creates negative transaction)
if (existing.starReward > 0 && existing.completedById) {
  await addStars({
    memberId: existing.completedById,
    amount: -existing.starReward,
    type: "chore",
    referenceId: choreId,
    description: `Undo: ${existing.title}`,
  });
}
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/services/chore-service.ts
git commit -m "feat(chores): integrate with star-service for completions"
```

---

## Phase 6: Verification

### Task 6.1: Run full test suite

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Final commit if needed**

```bash
git status
# If any uncommitted changes
git add .
git commit -m "chore: fix any remaining issues"
```

---

## Summary

| Phase | Tasks   | Description                            |
| ----- | ------- | -------------------------------------- |
| 1     | 1.1-1.2 | Database schema & migration            |
| 2     | 2.1     | Zod validation schemas                 |
| 3     | 3.1-3.7 | Star service core (TDD)                |
| 4     | 4.1-4.2 | API routes for balance & bonus         |
| 5     | 5.1-5.2 | Integration with reward-chart & chores |
| 6     | 6.1     | Full verification                      |

**Total Tasks:** 12 bite-sized tasks

**Future Work (not in this plan):**

- UI updates to show balance from star service
- Primary goal picker UI
- Reward store implementation
- Migration script for existing data
