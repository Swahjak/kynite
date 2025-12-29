# Deletion Functionality Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement complete deletion functionality for calendars (with events), family members (with accounts), and families (with all member accounts), using type-to-confirm safety dialogs.

**Architecture:** Schema changes enable cascade deletion of events when calendars are deleted. API routes are updated to delete user accounts when members/families are deleted. A reusable `DeleteConfirmationDialog` component handles type-to-confirm UX.

**Tech Stack:** Drizzle ORM, Next.js API routes, React, shadcn/ui AlertDialog, next-intl for i18n

---

## Task 1: Schema Change - Events Cascade on Calendar Delete

**Files:**

- Modify: `src/server/schema/calendars.ts:67-70`

**Step 1: Write the failing test**

Create test file `src/server/schema/__tests__/cascade-delete.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/server/db";
import { users, families, familyMembers, accounts } from "@/server/schema";
import { googleCalendars, events } from "@/server/schema/calendars";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

describe("cascade delete behavior", () => {
  const testIds = {
    userId: randomUUID(),
    familyId: randomUUID(),
    memberId: randomUUID(),
    accountId: randomUUID(),
    calendarId: randomUUID(),
    eventId: randomUUID(),
  };

  beforeEach(async () => {
    // Create test user
    await db.insert(users).values({
      id: testIds.userId,
      name: "Test User",
      email: `test-${testIds.userId}@example.com`,
    });

    // Create test family
    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    // Create family member
    await db.insert(familyMembers).values({
      id: testIds.memberId,
      familyId: testIds.familyId,
      userId: testIds.userId,
      role: "manager",
    });

    // Create test account
    await db.insert(accounts).values({
      id: testIds.accountId,
      userId: testIds.userId,
      accountId: "google-123",
      providerId: "google",
    });

    // Create test calendar
    await db.insert(googleCalendars).values({
      id: testIds.calendarId,
      familyId: testIds.familyId,
      accountId: testIds.accountId,
      googleCalendarId: "primary",
      name: "Test Calendar",
    });

    // Create test event linked to calendar
    await db.insert(events).values({
      id: testIds.eventId,
      familyId: testIds.familyId,
      googleCalendarId: testIds.calendarId,
      title: "Test Event",
      startTime: new Date(),
      endTime: new Date(),
    });
  });

  afterEach(async () => {
    // Clean up in reverse dependency order
    await db.delete(events).where(eq(events.familyId, testIds.familyId));
    await db
      .delete(googleCalendars)
      .where(eq(googleCalendars.id, testIds.calendarId));
    await db.delete(accounts).where(eq(accounts.id, testIds.accountId));
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.id, testIds.memberId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.userId));
  });

  it("should cascade delete events when calendar is deleted", async () => {
    // Verify event exists
    const eventsBefore = await db
      .select()
      .from(events)
      .where(eq(events.id, testIds.eventId));
    expect(eventsBefore).toHaveLength(1);

    // Delete calendar
    await db
      .delete(googleCalendars)
      .where(eq(googleCalendars.id, testIds.calendarId));

    // Verify event is also deleted
    const eventsAfter = await db
      .select()
      .from(events)
      .where(eq(events.id, testIds.eventId));
    expect(eventsAfter).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/schema/__tests__/cascade-delete.test.ts`

Expected: FAIL - Event still exists after calendar deletion (onDelete: "set null" behavior)

**Step 3: Update schema to cascade**

In `src/server/schema/calendars.ts`, change line 67-70:

```typescript
// Before:
googleCalendarId: text("google_calendar_id").references(
  () => googleCalendars.id,
  { onDelete: "set null" }
),

// After:
googleCalendarId: text("google_calendar_id").references(
  () => googleCalendars.id,
  { onDelete: "cascade" }
),
```

**Step 4: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`

**Step 5: Run test to verify it passes**

Run: `pnpm test:run src/server/schema/__tests__/cascade-delete.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/server/schema/calendars.ts src/server/schema/__tests__/cascade-delete.test.ts drizzle/
git commit -m "feat(schema): cascade delete events when calendar is deleted"
```

---

## Task 2: Schema Change - Unique User Per Family Constraint

**Files:**

- Modify: `src/server/schema/families.ts:22-35`

**Step 1: Write the failing test**

Add to `src/server/schema/__tests__/cascade-delete.test.ts`:

```typescript
import { uniqueIndex } from "drizzle-orm/pg-core";

describe("unique user per family constraint", () => {
  const testIds = {
    userId: randomUUID(),
    familyId1: randomUUID(),
    familyId2: randomUUID(),
    memberId1: randomUUID(),
    memberId2: randomUUID(),
  };

  beforeEach(async () => {
    await db.insert(users).values({
      id: testIds.userId,
      name: "Test User",
      email: `unique-test-${testIds.userId}@example.com`,
    });

    await db.insert(families).values([
      { id: testIds.familyId1, name: "Family 1" },
      { id: testIds.familyId2, name: "Family 2" },
    ]);

    await db.insert(familyMembers).values({
      id: testIds.memberId1,
      familyId: testIds.familyId1,
      userId: testIds.userId,
      role: "manager",
    });
  });

  afterEach(async () => {
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.userId, testIds.userId));
    await db.delete(families).where(eq(families.id, testIds.familyId1));
    await db.delete(families).where(eq(families.id, testIds.familyId2));
    await db.delete(users).where(eq(users.id, testIds.userId));
  });

  it("should prevent user from being in multiple families", async () => {
    await expect(
      db.insert(familyMembers).values({
        id: testIds.memberId2,
        familyId: testIds.familyId2,
        userId: testIds.userId,
        role: "participant",
      })
    ).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/schema/__tests__/cascade-delete.test.ts`

Expected: FAIL - Insert succeeds (no unique constraint)

**Step 3: Add unique index to schema**

In `src/server/schema/families.ts`, update the familyMembers table:

```typescript
import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const familyMembers = pgTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    displayName: text("display_name"),
    avatarColor: text("avatar_color"),
    avatarSvg: text("avatar_svg"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("family_members_user_id_unique").on(table.userId)]
);
```

**Step 4: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`

**Step 5: Run test to verify it passes**

Run: `pnpm test:run src/server/schema/__tests__/cascade-delete.test.ts`

Expected: PASS

**Step 6: Commit**

```bash
git add src/server/schema/families.ts drizzle/
git commit -m "feat(schema): add unique constraint for one family per user"
```

---

## Task 3: Create DeleteConfirmationDialog Component

**Files:**

- Create: `src/components/ui/delete-confirmation-dialog.tsx`
- Create: `src/components/ui/__tests__/delete-confirmation-dialog.test.tsx`

**Step 1: Write the failing test**

Create `src/components/ui/__tests__/delete-confirmation-dialog.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteConfirmationDialog } from "../delete-confirmation-dialog";

describe("DeleteConfirmationDialog", () => {
  it("renders with title and description", () => {
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Calendar"
        description="This will delete the calendar."
        confirmText="My Calendar"
        onConfirm={() => {}}
      />
    );

    expect(screen.getByText("Delete Calendar")).toBeInTheDocument();
    expect(screen.getByText("This will delete the calendar.")).toBeInTheDocument();
  });

  it("disables confirm button until text matches", async () => {
    const user = userEvent.setup();
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="My Calendar"
        onConfirm={() => {}}
      />
    );

    const confirmButton = screen.getByRole("button", { name: /delete/i });
    expect(confirmButton).toBeDisabled();

    const input = screen.getByPlaceholderText(/type "My Calendar"/i);
    await user.type(input, "My Calendar");

    expect(confirmButton).toBeEnabled();
  });

  it("calls onConfirm when text matches and button clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="TestName"
        onConfirm={onConfirm}
      />
    );

    const input = screen.getByPlaceholderText(/type "TestName"/i);
    await user.type(input, "TestName");

    const confirmButton = screen.getByRole("button", { name: /delete/i });
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows loading state when isDeleting is true", () => {
    render(
      <DeleteConfirmationDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Confirm deletion"
        confirmText="Test"
        onConfirm={() => {}}
        isDeleting={true}
      />
    );

    expect(screen.getByText(/deleting/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/ui/__tests__/delete-confirmation-dialog.test.tsx`

Expected: FAIL - Module not found

**Step 3: Create the component**

Create `src/components/ui/delete-confirmation-dialog.tsx`:

```typescript
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmText: string;
  onConfirm: () => void | Promise<void>;
  isDeleting?: boolean;
  confirmButtonText?: string;
}

export function DeleteConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  onConfirm,
  isDeleting = false,
  confirmButtonText = "Delete",
}: DeleteConfirmationDialogProps) {
  const [inputValue, setInputValue] = React.useState("");
  const isMatch = inputValue === confirmText;

  // Reset input when dialog closes
  React.useEffect(() => {
    if (!open) {
      setInputValue("");
    }
  }, [open]);

  async function handleConfirm() {
    if (!isMatch || isDeleting) return;
    await onConfirm();
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>{description}</p>
              <div className="space-y-2">
                <Label htmlFor="confirm-input">
                  Type <span className="font-semibold">"{confirmText}"</span> to confirm
                </Label>
                <Input
                  id="confirm-input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={`Type "${confirmText}" to confirm`}
                  disabled={isDeleting}
                  autoComplete="off"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              confirmButtonText
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/components/ui/__tests__/delete-confirmation-dialog.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ui/delete-confirmation-dialog.tsx src/components/ui/__tests__/delete-confirmation-dialog.test.tsx
git commit -m "feat(ui): add DeleteConfirmationDialog component with type-to-confirm"
```

---

## Task 4: Add Translations for Deletion

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` under appropriate sections:

```json
{
  "Deletion": {
    "calendar": {
      "title": "Delete Calendar",
      "description": "This will permanently delete <bold>{name}</bold> and all <bold>{count, plural, =1 {# event} other {# events}}</bold> synced from it.",
      "confirm": "Delete Calendar"
    },
    "member": {
      "title": "Delete Member",
      "description": "This will permanently delete <bold>{name}</bold> and their account. They will no longer be able to log in.",
      "confirm": "Delete Member"
    },
    "family": {
      "title": "Delete Family",
      "description": "This will permanently delete the <bold>{name}</bold> family, all data, and all member accounts ({count} {count, plural, =1 {member} other {members}}). No one will be able to log in.",
      "confirm": "Delete Family"
    }
  }
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
{
  "Deletion": {
    "calendar": {
      "title": "Kalender verwijderen",
      "description": "Dit verwijdert permanent <bold>{name}</bold> en alle <bold>{count, plural, =1 {# gebeurtenis} other {# gebeurtenissen}}</bold> die zijn gesynchroniseerd.",
      "confirm": "Kalender verwijderen"
    },
    "member": {
      "title": "Lid verwijderen",
      "description": "Dit verwijdert permanent <bold>{name}</bold> en hun account. Ze kunnen niet meer inloggen.",
      "confirm": "Lid verwijderen"
    },
    "family": {
      "title": "Familie verwijderen",
      "description": "Dit verwijdert permanent de <bold>{name}</bold> familie, alle gegevens en alle leden accounts ({count} {count, plural, =1 {lid} other {leden}}). Niemand kan meer inloggen.",
      "confirm": "Familie verwijderen"
    }
  }
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add deletion confirmation translations"
```

---

## Task 5: Update Family Delete API to Delete All Users

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/route.ts:108-133`

**Step 1: Write the failing test**

Create `src/app/api/v1/families/__tests__/delete-family.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { users, families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// Mock auth
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("DELETE /api/v1/families/[familyId]", () => {
  const testIds = {
    ownerId: randomUUID(),
    memberId: randomUUID(),
    familyId: randomUUID(),
    ownerMemberId: randomUUID(),
    memberMemberId: randomUUID(),
  };

  beforeEach(async () => {
    // Create owner user
    await db.insert(users).values({
      id: testIds.ownerId,
      name: "Owner",
      email: `owner-${testIds.ownerId}@example.com`,
    });

    // Create member user
    await db.insert(users).values({
      id: testIds.memberId,
      name: "Member",
      email: `member-${testIds.memberId}@example.com`,
    });

    // Create family
    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    // Add owner as manager
    await db.insert(familyMembers).values({
      id: testIds.ownerMemberId,
      familyId: testIds.familyId,
      userId: testIds.ownerId,
      role: "manager",
    });

    // Add member as participant
    await db.insert(familyMembers).values({
      id: testIds.memberMemberId,
      familyId: testIds.familyId,
      userId: testIds.memberId,
      role: "participant",
    });
  });

  afterEach(async () => {
    // Clean up any remaining data
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.familyId, testIds.familyId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.ownerId));
    await db.delete(users).where(eq(users.id, testIds.memberId));
  });

  it("should delete family and all user accounts", async () => {
    const { auth } = await import("@/server/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testIds.ownerId },
      session: { id: "session-1" },
    } as any);

    const { DELETE } = await import("../route");

    const request = new Request(
      "http://localhost/api/v1/families/" + testIds.familyId,
      {
        method: "DELETE",
      }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ familyId: testIds.familyId }),
    });

    expect(response.status).toBe(200);

    // Verify family is deleted
    const familyAfter = await db
      .select()
      .from(families)
      .where(eq(families.id, testIds.familyId));
    expect(familyAfter).toHaveLength(0);

    // Verify all users are deleted
    const ownerAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.ownerId));
    expect(ownerAfter).toHaveLength(0);

    const memberAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.memberId));
    expect(memberAfter).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/api/v1/families/__tests__/delete-family.test.ts`

Expected: FAIL - Users still exist after family deletion

**Step 3: Update the DELETE handler**

Update `src/app/api/v1/families/[familyId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  families,
  familyMembers,
  users,
  googleCalendars,
} from "@/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { updateFamilySchema } from "@/lib/validations/family";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import { stopWatchChannel } from "@/server/services/google-channel-service";
import { Errors } from "@/lib/errors";

// ... keep GET and PATCH unchanged ...

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      // 1. Collect all user IDs before deleting family
      const members = await tx
        .select({ userId: familyMembers.userId })
        .from(familyMembers)
        .where(eq(familyMembers.familyId, familyId));

      const userIds = members.map((m) => m.userId);

      // 2. Stop all Google push channels for calendars in this family
      const calendars = await tx
        .select({ id: googleCalendars.id })
        .from(googleCalendars)
        .where(eq(googleCalendars.familyId, familyId));

      for (const calendar of calendars) {
        try {
          await stopWatchChannel(calendar.id);
        } catch (error) {
          // Log but continue - channel will expire naturally
          console.error(
            `Failed to stop channel for calendar ${calendar.id}:`,
            error
          );
        }
      }

      // 3. Delete family (cascades to familyMembers, calendars, events, etc.)
      await tx.delete(families).where(eq(families.id, familyId));

      // 4. Delete all user accounts
      if (userIds.length > 0) {
        await tx.delete(users).where(inArray(users.id, userIds));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return Errors.internal();
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/app/api/v1/families/__tests__/delete-family.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/v1/families/[familyId]/route.ts src/app/api/v1/families/__tests__/delete-family.test.ts
git commit -m "feat(api): delete all user accounts when family is deleted"
```

---

## Task 6: Update Member Delete API to Delete User Account

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts:129-192`

**Step 1: Write the failing test**

Create `src/app/api/v1/families/[familyId]/members/__tests__/delete-member.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/server/db";
import { users, families, familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

describe("DELETE /api/v1/families/[familyId]/members/[memberId]", () => {
  const testIds = {
    managerId: randomUUID(),
    participantId: randomUUID(),
    familyId: randomUUID(),
    managerMemberId: randomUUID(),
    participantMemberId: randomUUID(),
  };

  beforeEach(async () => {
    await db.insert(users).values([
      {
        id: testIds.managerId,
        name: "Manager",
        email: `mgr-${testIds.managerId}@example.com`,
      },
      {
        id: testIds.participantId,
        name: "Participant",
        email: `part-${testIds.participantId}@example.com`,
      },
    ]);

    await db.insert(families).values({
      id: testIds.familyId,
      name: "Test Family",
    });

    await db.insert(familyMembers).values([
      {
        id: testIds.managerMemberId,
        familyId: testIds.familyId,
        userId: testIds.managerId,
        role: "manager",
      },
      {
        id: testIds.participantMemberId,
        familyId: testIds.familyId,
        userId: testIds.participantId,
        role: "participant",
      },
    ]);
  });

  afterEach(async () => {
    await db
      .delete(familyMembers)
      .where(eq(familyMembers.familyId, testIds.familyId));
    await db.delete(families).where(eq(families.id, testIds.familyId));
    await db.delete(users).where(eq(users.id, testIds.managerId));
    await db.delete(users).where(eq(users.id, testIds.participantId));
  });

  it("should delete member and their user account", async () => {
    const { auth } = await import("@/server/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: testIds.managerId },
      session: { id: "session-1" },
    } as any);

    const { DELETE } = await import("../../route");

    const request = new Request("http://localhost/test", { method: "DELETE" });

    const response = await DELETE(request, {
      params: Promise.resolve({
        familyId: testIds.familyId,
        memberId: testIds.participantMemberId,
      }),
    });

    expect(response.status).toBe(200);

    // Verify member is deleted
    const memberAfter = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, testIds.participantMemberId));
    expect(memberAfter).toHaveLength(0);

    // Verify user account is deleted
    const userAfter = await db
      .select()
      .from(users)
      .where(eq(users.id, testIds.participantId));
    expect(userAfter).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/app/api/v1/families/[familyId]/members/__tests__/delete-member.test.ts`

Expected: FAIL - User still exists

**Step 3: Update the DELETE handler**

Update `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers, users } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateMemberSchema } from "@/lib/validations/family";
import {
  isUserFamilyManager,
  updateMember,
} from "@/server/services/family-service";
import type { FamilyMemberRole } from "@/types/family";
import { Errors } from "@/lib/errors";

// ... keep PATCH unchanged ...

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId, memberId } = await params;

    // Get the target member
    const targetMember = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, memberId),
          eq(familyMembers.familyId, familyId)
        )
      )
      .limit(1);

    if (targetMember.length === 0) {
      return Errors.notFound("member");
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can remove others, anyone can leave (remove themselves)
    if (!isManager && !isSelf) {
      return Errors.forbidden();
    }

    // Check last manager constraint
    if (targetMember[0].role === "manager") {
      const managerCount = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, familyId),
            eq(familyMembers.role, "manager")
          )
        );

      if (managerCount.length <= 1) {
        return Errors.validation({
          member:
            "Cannot remove the last manager. Assign another manager first.",
        });
      }
    }

    const userId = targetMember[0].userId;

    // Use transaction to delete member and user atomically
    await db.transaction(async (tx) => {
      // Delete family member first (satisfies FK constraint)
      await tx.delete(familyMembers).where(eq(familyMembers.id, memberId));

      // Delete user account (cascades to sessions, accounts)
      await tx.delete(users).where(eq(users.id, userId));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return Errors.internal("Failed to remove member");
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/app/api/v1/families/[familyId]/members/__tests__/delete-member.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/v1/families/[familyId]/members/[memberId]/route.ts src/app/api/v1/families/[familyId]/members/__tests__/delete-member.test.ts
git commit -m "feat(api): delete user account when family member is removed"
```

---

## Task 7: Add Calendar Delete UI with Event Count

**Files:**

- Modify: `src/components/settings/linked-google-account-card.tsx`

**Step 1: Read existing component**

Run: Read the linked-google-account-card.tsx file to understand current structure.

**Step 2: Add delete functionality**

Add a delete button to each calendar card that opens the DeleteConfirmationDialog. The dialog should show the calendar name and event count.

This requires:

1. Fetching event count per calendar from an API endpoint
2. Adding the DeleteConfirmationDialog trigger
3. Calling DELETE /api/v1/families/[familyId]/calendars/[calendarId]

**Step 3: Test manually**

Verify in browser that:

- Delete button appears on calendar cards
- Dialog shows calendar name and event count
- Type-to-confirm works
- Calendar and events are deleted

**Step 4: Commit**

```bash
git add src/components/settings/linked-google-account-card.tsx
git commit -m "feat(ui): add calendar deletion with type-to-confirm dialog"
```

---

## Task 8: Add Member Delete UI in Family Settings

**Files:**

- Modify: `src/components/family/family-member-card.tsx`
- Modify: `src/components/family/family-settings-client.tsx`

**Step 1: Update family-member-card**

Add a delete button that opens DeleteConfirmationDialog with the member's name.

**Step 2: Update family-settings-client**

Update the handleRemoveMember function to work with the new dialog.

**Step 3: Test manually**

Verify:

- Delete button appears for managers
- Dialog shows member name
- Type-to-confirm works
- Member and user account are deleted

**Step 4: Commit**

```bash
git add src/components/family/family-member-card.tsx src/components/family/family-settings-client.tsx
git commit -m "feat(ui): add member deletion with type-to-confirm dialog"
```

---

## Task 9: Add Family Delete UI (Danger Zone)

**Files:**

- Modify: `src/components/family/family-settings-client.tsx`

**Step 1: Add Danger Zone section**

Add a new Card at the bottom of family-settings-client.tsx (only visible to managers) with:

- Title: "Danger Zone"
- Description explaining consequences
- Delete Family button that opens DeleteConfirmationDialog

**Step 2: Implement handleDeleteFamily**

```typescript
async function handleDeleteFamily() {
  setIsDeleting(true);
  try {
    const response = await fetch(`/api/v1/families/${family.id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!result.success) {
      toast.error(result.error?.message || "Failed to delete family");
      return;
    }

    toast.success("Family deleted");
    // Redirect to login since all accounts are deleted
    window.location.href = "/";
  } catch (error) {
    toast.error("Something went wrong");
  } finally {
    setIsDeleting(false);
  }
}
```

**Step 3: Test manually**

Verify:

- Danger Zone only appears for managers
- Dialog shows family name and member count
- Type-to-confirm works
- All data is deleted and user is logged out

**Step 4: Commit**

```bash
git add src/components/family/family-settings-client.tsx
git commit -m "feat(ui): add family deletion with danger zone and type-to-confirm"
```

---

## Task 10: Add Event Count API for Calendar Deletion

**Files:**

- Create: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/event-count/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { events } from "@/server/schema";
import { eq, count } from "drizzle-orm";
import { isUserFamilyMember } from "@/server/services/family-service";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId, calendarId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return Errors.notFamilyMember();
    }

    const result = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.googleCalendarId, calendarId));

    return NextResponse.json({
      success: true,
      data: { eventCount: result[0]?.count ?? 0 },
    });
  } catch (error) {
    console.error("Error getting event count:", error);
    return Errors.internal();
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/calendars/[calendarId]/event-count/route.ts
git commit -m "feat(api): add event count endpoint for calendar deletion dialog"
```

---

## Task 11: Run All Tests and Verify

**Step 1: Run full test suite**

Run: `pnpm test:run`

Expected: All tests pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: No type errors

**Step 3: Run lint**

Run: `pnpm lint`

Expected: No lint errors

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test/lint/type issues"
```

---

## Summary

This plan implements:

1. **Schema changes** - Events cascade delete when calendar deleted, unique user per family
2. **DeleteConfirmationDialog** - Reusable type-to-confirm component
3. **API updates** - Family and member deletion now delete user accounts
4. **UI updates** - Calendar, member, and family deletion with confirmation dialogs
5. **Translations** - English and Dutch for all deletion messages

Total tasks: 11
