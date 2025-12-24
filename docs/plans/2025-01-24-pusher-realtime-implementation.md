# Pusher Real-Time Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace dashboard polling with Pusher Channels for real-time cross-device sync.

**Architecture:** Server-side services broadcast events via Pusher after DB mutations. Client subscribes to family channel on mount and updates React Query cache directly. Manual refresh button as fallback.

**Tech Stack:** Pusher (server SDK), pusher-js (client SDK), React Query cache manipulation, better-auth for channel authorization.

---

## Task 1: Install Pusher Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install server and client Pusher packages**

Run:

```bash
pnpm add pusher pusher-js
```

**Step 2: Verify installation**

Run:

```bash
pnpm list pusher pusher-js
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add pusher and pusher-js dependencies"
```

---

## Task 2: Create Pusher Server Library

**Files:**

- Create: `src/lib/pusher.ts`

**Step 1: Create the server-side Pusher module**

```typescript
import Pusher from "pusher";

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Fire-and-forget broadcast - never blocks the calling function
 */
export function broadcast(channel: string, event: string, data: unknown): void {
  pusherServer.trigger(channel, event, data).catch((error) => {
    console.error(
      `[Pusher] Failed to broadcast ${event} to ${channel}:`,
      error
    );
  });
}

/**
 * Broadcast an event to a family's private channel
 */
export function broadcastToFamily(
  familyId: string,
  event: string,
  data: unknown
): void {
  broadcast(`private-family-${familyId}`, event, data);
}

export { pusherServer };
```

**Step 2: Commit**

```bash
git add src/lib/pusher.ts
git commit -m "feat: add Pusher server library with broadcastToFamily helper"
```

---

## Task 3: Create Pusher Auth Endpoint

**Files:**

- Create: `src/app/api/pusher/auth/route.ts`
- Test: `src/app/api/pusher/__tests__/auth.test.ts`

**Step 1: Write failing test for auth endpoint**

Create `src/app/api/pusher/__tests__/auth.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock modules before imports
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  },
}));

vi.mock("@/lib/pusher", () => ({
  pusherServer: {
    authorizeChannel: vi.fn(() => ({ auth: "mock-auth-token" })),
  },
}));

import { POST } from "../route";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { pusherServer } from "@/lib/pusher";

describe("Pusher Auth Endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-test-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 403 when user is not in the family", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
      session: {},
    } as never);

    // Mock empty family members result
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as never);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-other-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it("returns auth token when user belongs to family", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
      session: {},
    } as never);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ familyId: "test-family-id" }]),
        }),
      }),
    } as never);

    const formData = new FormData();
    formData.append("socket_id", "123.456");
    formData.append("channel_name", "private-family-test-family-id");

    const request = new Request("http://localhost/api/pusher/auth", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.auth).toBe("mock-auth-token");
    expect(pusherServer.authorizeChannel).toHaveBeenCalledWith(
      "123.456",
      "private-family-test-family-id"
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:run src/app/api/pusher/__tests__/auth.test.ts
```

Expected: FAIL - Cannot find module '../route'

**Step 3: Create the auth endpoint**

Create `src/app/api/pusher/auth/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const socketId = formData.get("socket_id") as string;
  const channel = formData.get("channel_name") as string;

  // Extract family ID from channel name
  const familyId = channel.replace("private-family-", "");

  // Verify user belongs to this family
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.userId, session.user.id))
    .limit(1);

  if (members.length === 0 || members[0].familyId !== familyId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const authResponse = pusherServer.authorizeChannel(socketId, channel);
  return NextResponse.json(authResponse);
}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test:run src/app/api/pusher/__tests__/auth.test.ts
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/app/api/pusher/
git commit -m "feat: add Pusher auth endpoint for private channels"
```

---

## Task 4: Add Broadcasts to Timer Service

**Files:**

- Modify: `src/server/services/active-timer-service.ts`
- Test: `src/server/services/__tests__/active-timer-service.test.ts`

**Step 1: Add broadcast import and calls to timer service**

At the top of `src/server/services/active-timer-service.ts`, add:

```typescript
import { broadcastToFamily } from "@/lib/pusher";
```

**Step 2: Add broadcast to startTimerFromTemplate**

After `return timer;` in `startTimerFromTemplate()` (around line 120), add before the return:

```typescript
broadcastToFamily(familyId, "timer:started", { timer });

return timer;
```

**Step 3: Add broadcast to startOneOffTimer**

After creating the timer in `startOneOffTimer()` (around line 158), add before the return:

```typescript
broadcastToFamily(familyId, "timer:started", { timer });

return timer;
```

**Step 4: Add broadcast to pauseTimer**

After updating in `pauseTimer()` (around line 188), add before the return:

```typescript
broadcastToFamily(familyId, "timer:updated", { timer: updated });

return updated;
```

**Step 5: Add broadcast to resumeTimer**

After updating in `resumeTimer()` (around line 215), add before the return:

```typescript
broadcastToFamily(familyId, "timer:updated", { timer: updated });

return updated;
```

**Step 6: Add broadcast to extendTimer**

After updating in `extendTimer()` (around line 242), add before the return:

```typescript
broadcastToFamily(familyId, "timer:updated", { timer: updated });

return updated;
```

**Step 7: Add broadcast to cancelTimer**

At the end of `cancelTimer()` (around line 263), add:

```typescript
broadcastToFamily(familyId, "timer:cancelled", { timerId });
```

**Step 8: Add broadcast to syncTimerState**

After updating in `syncTimerState()` (around line 307), add before the return:

```typescript
broadcastToFamily(familyId, "timer:updated", { timer: updated });

return updated;
```

**Step 9: Add broadcast to confirmTimer**

After awarding stars in `confirmTimer()` (around line 392), add before the return:

```typescript
broadcastToFamily(familyId, "timer:completed", {
  timer: updated,
  starsAwarded,
});

return { timer: updated, starsAwarded };
```

**Step 10: Run existing tests to verify no regressions**

Run:

```bash
pnpm test:run src/server/services/__tests__/active-timer-service.test.ts
```

Expected: All 11 tests PASS (broadcasts are fire-and-forget, don't affect test outcomes)

**Step 11: Commit**

```bash
git add src/server/services/active-timer-service.ts
git commit -m "feat: add Pusher broadcasts to timer service"
```

---

## Task 5: Add Broadcasts to Star Service

**Files:**

- Modify: `src/server/services/star-service.ts`

**Step 1: Add broadcast import**

At the top of `src/server/services/star-service.ts`, add:

```typescript
import { broadcastToFamily } from "@/lib/pusher";
```

**Step 2: Add broadcast to addStars**

After the transaction in `addStars()` (around line 98), add before the return:

```typescript
broadcastToFamily(familyId, "stars:updated", {
  memberId: input.memberId,
  newBalance,
});

return { transaction, newBalance };
```

**Step 3: Add broadcast to removeStars**

After the transaction in `removeStars()` (around line 183), add before the return:

```typescript
broadcastToFamily(familyId, "stars:updated", {
  memberId: input.memberId,
  newBalance,
});

return { transaction, newBalance };
```

**Step 4: Run existing tests to verify no regressions**

Run:

```bash
pnpm test:run src/server/services/__tests__/star-service.test.ts
```

Expected: All 7 tests PASS

**Step 5: Commit**

```bash
git add src/server/services/star-service.ts
git commit -m "feat: add Pusher broadcasts to star service"
```

---

## Task 6: Create Pusher Client Library

**Files:**

- Create: `src/lib/pusher-client.ts`

**Step 1: Create the client-side Pusher module**

```typescript
"use client";

import PusherClient from "pusher-js";

let pusherInstance: PusherClient | null = null;

export function getPusher(): PusherClient {
  if (typeof window === "undefined") {
    throw new Error("Pusher client can only be used in browser");
  }

  if (!pusherInstance) {
    pusherInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });
  }

  return pusherInstance;
}

export function disconnectPusher(): void {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}
```

**Step 2: Commit**

```bash
git add src/lib/pusher-client.ts
git commit -m "feat: add Pusher client library singleton"
```

---

## Task 7: Create useFamilyChannel Hook

**Files:**

- Create: `src/hooks/use-family-channel.ts`
- Test: `src/hooks/__tests__/use-family-channel.test.ts`

**Step 1: Write failing test**

Create `src/hooks/__tests__/use-family-channel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";

// Mock pusher-client before importing hook
const mockBind = vi.fn();
const mockUnbind = vi.fn();
const mockSubscribe = vi.fn(() => ({
  bind: mockBind,
  unbind: mockUnbind,
}));
const mockUnsubscribe = vi.fn();

vi.mock("@/lib/pusher-client", () => ({
  getPusher: vi.fn(() => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
  })),
}));

import { useFamilyChannel } from "../use-family-channel";

describe("useFamilyChannel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it("does nothing when familyId is undefined", () => {
    renderHook(() =>
      useFamilyChannel(undefined, {
        "timer:started": vi.fn(),
      })
    );

    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("subscribes to family channel on mount", () => {
    const handler = vi.fn();

    renderHook(() =>
      useFamilyChannel("family-123", {
        "timer:started": handler,
      })
    );

    expect(mockSubscribe).toHaveBeenCalledWith("private-family-family-123");
    expect(mockBind).toHaveBeenCalledWith("timer:started", handler);
  });

  it("unsubscribes on unmount", () => {
    const handler = vi.fn();

    const { unmount } = renderHook(() =>
      useFamilyChannel("family-123", {
        "timer:started": handler,
      })
    );

    unmount();

    expect(mockUnbind).toHaveBeenCalledWith("timer:started");
    expect(mockUnsubscribe).toHaveBeenCalledWith("private-family-family-123");
  });
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
pnpm test:run src/hooks/__tests__/use-family-channel.test.ts
```

Expected: FAIL - Cannot find module '../use-family-channel'

**Step 3: Create the hook**

Create `src/hooks/use-family-channel.ts`:

```typescript
"use client";

import { useEffect, useRef } from "react";
import { getPusher } from "@/lib/pusher-client";
import type { Channel } from "pusher-js";

type EventHandler = (data: unknown) => void;

export function useFamilyChannel(
  familyId: string | undefined,
  handlers: Record<string, EventHandler>
): void {
  const channelRef = useRef<Channel | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref updated
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!familyId) return;

    const pusher = getPusher();
    const channelName = `private-family-${familyId}`;
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;

    // Bind all handlers
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });

    return () => {
      // Unbind all handlers
      Object.keys(handlersRef.current).forEach((event) => {
        channel.unbind(event);
      });
      pusher.unsubscribe(channelName);
      channelRef.current = null;
    };
  }, [familyId]);
}
```

**Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test:run src/hooks/__tests__/use-family-channel.test.ts
```

Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/hooks/use-family-channel.ts src/hooks/__tests__/use-family-channel.test.ts
git commit -m "feat: add useFamilyChannel hook for Pusher subscriptions"
```

---

## Task 8: Update Dashboard Context with Pusher

**Files:**

- Modify: `src/components/dashboard/contexts/dashboard-context.tsx`

**Step 1: Read current dashboard context**

Understand the current structure before modifying.

**Step 2: Add imports**

Add near the top of the file:

```typescript
import { useFamilyChannel } from "@/hooks/use-family-channel";
```

**Step 3: Remove polling from timer query**

Find the `useQuery` for `activeTimers` and change:

```typescript
// BEFORE
const { data: apiTimers = [], isLoading: isLoadingTimers } = useQuery({
  queryKey: ["activeTimers"],
  queryFn: async () => {
    const res = await fetch("/api/v1/timers/active");
    const data = await res.json();
    return data.success ? data.data.timers : [];
  },
  refetchInterval: 60000,
  staleTime: 30000,
});

// AFTER
const { data: apiTimers = [], isLoading: isLoadingTimers } = useQuery({
  queryKey: ["activeTimers"],
  queryFn: async () => {
    const res = await fetch("/api/v1/timers/active");
    const data = await res.json();
    return data.success ? data.data.timers : [];
  },
  staleTime: Infinity,
});
```

**Step 4: Add Pusher subscription**

Inside the provider component, after the queries and before the return, add:

```typescript
// Real-time updates via Pusher
useFamilyChannel(familyId, {
  "timer:started": (data: unknown) => {
    const { timer } = data as { timer: ActiveTimer };
    queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) => [
      ...(old ?? []),
      timer,
    ]);
  },
  "timer:updated": (data: unknown) => {
    const { timer } = data as { timer: ActiveTimer };
    queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
      (old ?? []).map((t) => (t.id === timer.id ? timer : t))
    );
  },
  "timer:cancelled": (data: unknown) => {
    const { timerId } = data as { timerId: string };
    queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
      (old ?? []).filter((t) => t.id !== timerId)
    );
  },
  "timer:completed": (data: unknown) => {
    const { timer } = data as { timer: ActiveTimer };
    queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
      (old ?? []).filter((t) => t.id !== timer.id)
    );
  },
  "timer:expired": (data: unknown) => {
    const { timer } = data as { timer: ActiveTimer };
    queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
      (old ?? []).map((t) => (t.id === timer.id ? timer : t))
    );
  },
  "stars:updated": () => {
    queryClient.invalidateQueries({ queryKey: ["weeklyStars"] });
  },
  "chore:completed": () => {
    queryClient.invalidateQueries({ queryKey: ["chores"] });
  },
});
```

Note: You'll need to import `ActiveTimer` type and get `familyId` from the data passed to the provider. Check existing code for how `familyId` is obtained.

**Step 5: Add manual refresh function**

Add a refresh function to the context value:

```typescript
const refreshAll = useCallback(async () => {
  await queryClient.invalidateQueries();
}, [queryClient]);
```

And include it in the context value that's provided.

**Step 6: Run existing tests**

Run:

```bash
pnpm test:run src/components/dashboard/__tests__/
```

Expected: All tests PASS

**Step 7: Commit**

```bash
git add src/components/dashboard/contexts/dashboard-context.tsx
git commit -m "feat: replace timer polling with Pusher real-time updates"
```

---

## Task 9: Add Refresh Button to Dashboard

**Files:**

- Create: `src/components/dashboard/refresh-button.tsx`
- Modify: Dashboard header component (find the correct file)

**Step 1: Create RefreshButton component**

Create `src/components/dashboard/refresh-button.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RefreshButton() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleRefresh}
      disabled={isRefreshing}
      aria-label="Refresh dashboard"
    >
      <RefreshCw
        className={cn("h-4 w-4", isRefreshing && "animate-spin")}
      />
    </Button>
  );
}
```

**Step 2: Add to dashboard header**

Find the dashboard header component and add the RefreshButton. Import and place it appropriately in the header area.

**Step 3: Commit**

```bash
git add src/components/dashboard/refresh-button.tsx
git add <modified-header-file>
git commit -m "feat: add manual refresh button to dashboard"
```

---

## Task 10: Add Environment Variables Documentation

**Files:**

- Modify: `.env.example` (if exists) or document in README

**Step 1: Document required environment variables**

Add to `.env.example` or create it:

```bash
# Pusher (server-side only)
PUSHER_APP_ID=
PUSHER_SECRET=

# Pusher (client-side - NEXT_PUBLIC_ prefix required)
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=eu
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add Pusher environment variables to .env.example"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all unit tests**

Run:

```bash
pnpm test:run
```

Expected: All tests PASS

**Step 2: Run linting**

Run:

```bash
pnpm lint
```

Expected: No errors

**Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: Build succeeds (may show warnings about missing env vars - that's OK)

---

## Task 12: Final Commit and Summary

**Step 1: Verify all changes**

Run:

```bash
git log --oneline main..HEAD
```

Expected commits:

1. chore: add pusher and pusher-js dependencies
2. feat: add Pusher server library with broadcastToFamily helper
3. feat: add Pusher auth endpoint for private channels
4. feat: add Pusher broadcasts to timer service
5. feat: add Pusher broadcasts to star service
6. feat: add Pusher client library singleton
7. feat: add useFamilyChannel hook for Pusher subscriptions
8. feat: replace timer polling with Pusher real-time updates
9. feat: add manual refresh button to dashboard
10. docs: add Pusher environment variables to .env.example

**Step 2: Create PR or merge**

Use `superpowers:finishing-a-development-branch` skill to complete the work.
