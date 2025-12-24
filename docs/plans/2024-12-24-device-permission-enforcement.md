# Device Permission Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `requireNonDeviceSession` checks to all mutation endpoints that devices should not access, implementing defense-in-depth security.

**Architecture:** Create a reusable helper that returns proper API responses (not throws), then systematically apply it to all management endpoints. Interaction endpoints (complete chore, confirm timer, redeem reward) remain accessible to devices.

**Tech Stack:** Next.js API routes, TypeScript, better-auth sessions

---

## Endpoint Classification

### BLOCKED for devices (management operations):

- Create/update/delete chores, events, rewards, timers, etc.
- Family settings, member management, invites
- Calendar linking and configuration

### ALLOWED for devices (interaction operations):

- Complete/undo chores
- Start/confirm timers
- Complete/undo reward chart tasks
- Redeem rewards
- Sync calendars

---

## Task 1: Create Device Check Helper for API Routes

**Files:**

- Create: `src/lib/api-auth.ts`

**Step 1: Create the helper file**

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";

/**
 * Standard unauthorized response
 */
export const UNAUTHORIZED_RESPONSE = NextResponse.json(
  {
    success: false,
    error: { code: "UNAUTHORIZED", message: "Not authenticated" },
  },
  { status: 401 }
);

/**
 * Device forbidden response
 */
export const DEVICE_FORBIDDEN_RESPONSE = NextResponse.json(
  {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Devices cannot perform this action",
    },
  },
  { status: 403 }
);

/**
 * Get session and check it's not a device.
 * Returns session if valid non-device user, or null with appropriate response.
 */
export async function getNonDeviceSession(): Promise<{
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
  errorResponse: NextResponse | null;
}> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return { session: null, errorResponse: UNAUTHORIZED_RESPONSE };
  }

  // Check if this is a device session
  const isDevice = (session.user as { type?: string }).type === "device";
  if (isDevice) {
    return { session: null, errorResponse: DEVICE_FORBIDDEN_RESPONSE };
  }

  return { session, errorResponse: null };
}
```

**Step 2: Commit**

```bash
git add src/lib/api-auth.ts
git commit -m "feat(api): add getNonDeviceSession helper for device permission checks"
```

---

## Task 2: Protect Chore Management Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/chores/route.ts` (POST only)
- Modify: `src/app/api/v1/families/[familyId]/chores/[choreId]/route.ts` (PATCH, DELETE)

**Step 1: Update chores/route.ts POST handler**

Replace the session check in POST with:

```typescript
import { getNonDeviceSession } from "@/lib/api-auth";

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;

    // ... rest of existing code using session ...
```

Remove the old `auth.api.getSession` import and call for POST.

**Step 2: Update chores/[choreId]/route.ts PATCH and DELETE handlers**

Same pattern - replace session check with `getNonDeviceSession()`.

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/chores/
git commit -m "fix(api): block device access to chore management endpoints"
```

---

## Task 3: Protect Event Management Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/events/route.ts` (POST only)
- Modify: `src/app/api/v1/families/[familyId]/events/[eventId]/route.ts` (PATCH, DELETE)

**Step 1: Update events/route.ts POST handler**

```typescript
import { getNonDeviceSession } from "@/lib/api-auth";

export async function POST(request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;
    // ... rest unchanged ...
```

**Step 2: Update events/[eventId]/route.ts PATCH and DELETE handlers**

Same pattern.

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/events/
git commit -m "fix(api): block device access to event management endpoints"
```

---

## Task 4: Protect Family Management Endpoints

**Files:**

- Modify: `src/app/api/v1/families/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/v1/families/[familyId]/members/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/route.ts` (PATCH, DELETE)

**Step 1: Update each file's mutation handlers**

Replace `auth.api.getSession` with `getNonDeviceSession()` pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/families/
git commit -m "fix(api): block device access to family management endpoints"
```

---

## Task 5: Protect Invite Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/invites/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts` (DELETE)
- Modify: `src/app/api/v1/invites/[token]/accept/route.ts` (POST)

**Step 1: Update each mutation handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/invites/ src/app/api/v1/invites/
git commit -m "fix(api): block device access to invite endpoints"
```

---

## Task 6: Protect Calendar Management Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/calendars/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/channel/route.ts` (POST, DELETE)
- Modify: `src/app/api/v1/calendars/[calendarId]/privacy/route.ts` (PATCH)

**Note:** Leave `sync/route.ts` unchanged - devices can trigger syncs.

**Step 1: Update each mutation handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/calendars/ src/app/api/v1/calendars/
git commit -m "fix(api): block device access to calendar management endpoints"
```

---

## Task 7: Protect Reward Store Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/rewards/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/rewards/[rewardId]/route.ts` (PUT, DELETE)

**Note:** Leave `redeem/route.ts` unchanged - devices can redeem rewards.

**Step 1: Update each mutation handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/rewards/
git commit -m "fix(api): block device access to reward store management endpoints"
```

---

## Task 8: Protect Reward Chart Management Endpoints

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/reward-charts/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/route.ts` (PUT, DELETE)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/reorder/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/[goalId]/route.ts` (PUT)
- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/messages/route.ts` (POST)
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/primary-goal/route.ts` (PUT, DELETE)
- Modify: `src/app/api/v1/families/[familyId]/members/[memberId]/stars/bonus/route.ts` (POST)

**Note:** Leave `complete/route.ts` and `undo/route.ts` unchanged - devices can complete/undo tasks.

**Step 1: Update each mutation handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/families/[familyId]/reward-charts/ src/app/api/v1/families/[familyId]/members/
git commit -m "fix(api): block device access to reward chart management endpoints"
```

---

## Task 9: Protect Timer Management Endpoints

**Files:**

- Modify: `src/app/api/v1/timers/templates/route.ts` (POST)
- Modify: `src/app/api/v1/timers/templates/[id]/route.ts` (PATCH, DELETE)
- Modify: `src/app/api/v1/timers/active/[id]/route.ts` (PATCH, DELETE)

**Note:** Leave `active/route.ts` POST unchanged - devices can start timers.
**Note:** Leave `confirm/route.ts` unchanged - devices can confirm timers.

**Step 1: Update each mutation handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/timers/
git commit -m "fix(api): block device access to timer management endpoints"
```

---

## Task 10: Protect Account Management Endpoints

**Files:**

- Modify: `src/app/api/v1/accounts/linked/[accountId]/route.ts` (DELETE)

**Step 1: Update DELETE handler**

Same pattern.

**Step 2: Commit**

```bash
git add src/app/api/v1/accounts/
git commit -m "fix(api): block device access to account management endpoints"
```

---

## Task 11: Verify Build and Tests

**Step 1: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No new errors

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address any build issues from device permission changes"
```

---

## Summary

This plan protects **30+ mutation endpoints** across 9 categories:

| Category      | Protected Endpoints                | Device-Allowed Endpoints |
| ------------- | ---------------------------------- | ------------------------ |
| Chores        | create, update, delete             | complete, undo           |
| Events        | create, update, delete             | -                        |
| Family        | create, update, delete, members    | -                        |
| Invites       | create, revoke, accept             | -                        |
| Calendars     | link, update, delete, channels     | sync                     |
| Rewards       | create, update, delete             | redeem                   |
| Reward Charts | create, update, delete tasks/goals | complete, undo tasks     |
| Timers        | create, update, delete templates   | start, confirm           |
| Accounts      | unlink                             | -                        |

**Total commits:** 11
**Estimated time:** 30-45 minutes with parallel execution
