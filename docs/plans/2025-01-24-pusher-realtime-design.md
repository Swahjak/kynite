# Dashboard Real-Time Updates with Pusher

**Date:** 2025-01-24
**Status:** Approved
**Goal:** Eliminate polling, reduce Vercel function invocations, enable real-time cross-device sync

## Problem

The dashboard polls for timer updates every 60 seconds, causing unnecessary Vercel function invocations and costs. With 2-3 devices typically open, this adds up.

## Solution

Replace polling with Pusher Channels for real-time WebSocket updates. Pusher handles the persistent connections externally, which works with Vercel's serverless architecture.

## Architecture

### Channel Structure

Single private channel per family:

```
private-family-{familyId}
```

Private channels require authentication via `/api/pusher/auth`.

### Events

| Event             | Triggered When           | Payload                    |
| ----------------- | ------------------------ | -------------------------- |
| `timer:started`   | New timer created        | `{ timer }`                |
| `timer:updated`   | Pause/resume/extend/sync | `{ timer }`                |
| `timer:cancelled` | User cancels             | `{ timerId }`              |
| `timer:completed` | Timer confirmed          | `{ timer, starsAwarded }`  |
| `timer:expired`   | Timer hits zero          | `{ timer }`                |
| `chore:completed` | Chore marked done        | `{ choreId, completedBy }` |
| `stars:updated`   | Stars added/removed      | `{ memberId, newBalance }` |

### Data Flow

```
User Action → API Route → Service Layer → DB + Pusher.trigger()
                                              ↓
                                         Pusher Server
                                              ↓
                                    All subscribed clients
                                              ↓
                                    React Query cache update
```

## Implementation

### Server-Side

#### 1. Pusher Server Library (`src/lib/pusher.ts`)

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

export function broadcastToFamily(
  familyId: string,
  event: string,
  data: unknown
): void {
  broadcast(`private-family-${familyId}`, event, data);
}

export { pusherServer };
```

#### 2. Auth Endpoint (`src/app/api/pusher/auth/route.ts`)

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

#### 3. Service Layer Changes

**`src/server/services/active-timer-service.ts`** - Add broadcasts:

| Function                   | Add after DB operation                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `startTimerFromTemplate()` | `broadcastToFamily(familyId, "timer:started", { timer })`                          |
| `startOneOffTimer()`       | `broadcastToFamily(familyId, "timer:started", { timer })`                          |
| `pauseTimer()`             | `broadcastToFamily(familyId, "timer:updated", { timer: updated })`                 |
| `resumeTimer()`            | `broadcastToFamily(familyId, "timer:updated", { timer: updated })`                 |
| `extendTimer()`            | `broadcastToFamily(familyId, "timer:updated", { timer: updated })`                 |
| `cancelTimer()`            | `broadcastToFamily(familyId, "timer:cancelled", { timerId })`                      |
| `syncTimerState()`         | `broadcastToFamily(familyId, "timer:updated", { timer: updated })`                 |
| `confirmTimer()`           | `broadcastToFamily(familyId, "timer:completed", { timer: updated, starsAwarded })` |

**`src/server/services/star-service.ts`** - Add broadcasts:

| Function        | Add after transaction                                                                    |
| --------------- | ---------------------------------------------------------------------------------------- |
| `addStars()`    | `broadcastToFamily(familyId, "stars:updated", { memberId: input.memberId, newBalance })` |
| `removeStars()` | `broadcastToFamily(familyId, "stars:updated", { memberId: input.memberId, newBalance })` |

### Client-Side

#### 1. Pusher Client (`src/lib/pusher-client.ts`)

```typescript
import PusherClient from "pusher-js";

let pusherInstance: PusherClient | null = null;

export function getPusher(): PusherClient {
  if (!pusherInstance) {
    pusherInstance = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });
  }
  return pusherInstance;
}
```

#### 2. React Hook (`src/hooks/use-pusher-channel.ts`)

```typescript
import { useEffect, useRef } from "react";
import { getPusher } from "@/lib/pusher-client";
import type { Channel } from "pusher-js";

type EventHandler = (data: unknown) => void;

export function useFamilyChannel(
  familyId: string | undefined,
  handlers: Record<string, EventHandler>
) {
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!familyId) return;

    const pusher = getPusher();
    const channel = pusher.subscribe(`private-family-${familyId}`);
    channelRef.current = channel;

    Object.entries(handlers).forEach(([event, handler]) => {
      channel.bind(event, handler);
    });

    return () => {
      Object.keys(handlers).forEach((event) => {
        channel.unbind(event);
      });
      pusher.unsubscribe(`private-family-${familyId}`);
    };
  }, [familyId]);
}
```

#### 3. Dashboard Context Changes

**`src/components/dashboard/contexts/dashboard-context.tsx`**

Replace polling with Pusher subscription:

```typescript
// Remove refetchInterval from useQuery
const { data: apiTimers = [] } = useQuery({
  queryKey: ["activeTimers"],
  queryFn: fetchTimers,
  staleTime: Infinity, // Never auto-refetch
});

// Add Pusher subscription
useFamilyChannel(familyId, {
  "timer:started": (data) => {
    queryClient.setQueryData(["activeTimers"], (old) => [
      ...(old ?? []),
      data.timer,
    ]);
  },
  "timer:updated": (data) => {
    queryClient.setQueryData(["activeTimers"], (old) =>
      (old ?? []).map((t) => (t.id === data.timer.id ? data.timer : t))
    );
  },
  "timer:cancelled": (data) => {
    queryClient.setQueryData(["activeTimers"], (old) =>
      (old ?? []).filter((t) => t.id !== data.timerId)
    );
  },
  "timer:completed": (data) => {
    queryClient.setQueryData(["activeTimers"], (old) =>
      (old ?? []).filter((t) => t.id !== data.timer.id)
    );
  },
  "stars:updated": (data) => {
    queryClient.invalidateQueries({ queryKey: ["weeklyStars"] });
  },
  "chore:completed": () => {
    queryClient.invalidateQueries({ queryKey: ["chores"] });
  },
});
```

#### 4. Refresh Button

Add to dashboard header:

```typescript
function RefreshButton() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
    </Button>
  );
}
```

## Environment Variables

Add to `.env.local`:

```bash
# Pusher (server-side only)
PUSHER_APP_ID=your_app_id
PUSHER_SECRET=your_secret

# Pusher (client-side - NEXT_PUBLIC_ prefix required)
NEXT_PUBLIC_PUSHER_KEY=your_key
NEXT_PUBLIC_PUSHER_CLUSTER=eu
```

## Dependencies

```bash
pnpm add pusher pusher-js
```

## Pusher Pricing

Using Sandbox (free) tier:

- 200,000 messages/day
- 100 concurrent connections
- Sufficient for family use and early commercialization

## Files Changed

| File                                                      | Action                    |
| --------------------------------------------------------- | ------------------------- |
| `src/lib/pusher.ts`                                       | Create                    |
| `src/lib/pusher-client.ts`                                | Create                    |
| `src/hooks/use-pusher-channel.ts`                         | Create                    |
| `src/app/api/pusher/auth/route.ts`                        | Create                    |
| `src/server/services/active-timer-service.ts`             | Modify                    |
| `src/server/services/star-service.ts`                     | Modify                    |
| `src/components/dashboard/contexts/dashboard-context.tsx` | Modify                    |
| Dashboard header component                                | Modify                    |
| `.env.local`                                              | Modify                    |
| `package.json`                                            | Modify (add dependencies) |

## Error Handling

Pusher broadcasts use fire-and-forget pattern:

- DB operation is source of truth
- Pusher failure is logged but doesn't block user action
- Manual refresh button serves as fallback

## Testing Considerations

- Mock Pusher in tests
- Test auth endpoint with valid/invalid family membership
- Test React Query cache updates from Pusher events
- E2E: Test cross-device sync with two browser windows
