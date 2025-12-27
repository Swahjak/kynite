# Local Cache Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate loading flashes on page reload by persisting React Query cache to IndexedDB and showing stale data instantly while refreshing in background.

**Architecture:** Wrap existing QueryClientProvider with PersistQueryClientProvider, using idb-keyval for IndexedDB storage. Add a traffic-light status indicator (green/amber/red) at bottom-right showing live/stale/offline state.

**Tech Stack:** @tanstack/react-query-persist-client, idb-keyval, React context, useSyncExternalStore

---

## Task 1: Install Dependencies

**Files:**

- Modify: `package.json`

**Step 1: Install packages**

Run:

```bash
pnpm add @tanstack/react-query-persist-client idb-keyval
```

Expected: Packages added to dependencies

**Step 2: Verify installation**

Run:

```bash
pnpm ls @tanstack/react-query-persist-client idb-keyval
```

Expected: Both packages listed with versions

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add react-query-persist-client and idb-keyval"
```

---

## Task 2: Create Cache Configuration

**Files:**

- Create: `src/lib/query/cache-config.ts`

**Step 1: Create the config file**

```typescript
/**
 * Centralized cache configuration for React Query persistence.
 * Increment CACHE_VERSION when query data shapes change.
 */
export const CACHE_CONFIG = {
  /** Maximum age for persisted cache (24 hours in ms) */
  MAX_AGE: 1000 * 60 * 60 * 24,

  /** Cache buster version - increment when schema changes */
  CACHE_VERSION: 1,

  /** IndexedDB database key */
  IDB_KEY: "family-planner-query-cache",

  /** Query key prefixes to exclude from persistence */
  EXCLUDED_PREFIXES: ["timers", "invite"] as const,

  /** Default stale time for queries (30 seconds) */
  DEFAULT_STALE_TIME: 30_000,
} as const;

export type ExcludedPrefix = (typeof CACHE_CONFIG.EXCLUDED_PREFIXES)[number];
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/query/cache-config.ts
git commit -m "feat(cache): add centralized cache configuration"
```

---

## Task 3: Create IndexedDB Persister

**Files:**

- Create: `src/lib/query/persister.ts`

**Step 1: Create the persister file**

```typescript
import { get, set, del } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { CACHE_CONFIG } from "./cache-config";

/**
 * Creates an IndexedDB-backed persister for React Query.
 * Uses idb-keyval for simple key-value storage.
 */
export function createIndexedDBPersister(): Persister {
  const key = `${CACHE_CONFIG.IDB_KEY}-v${CACHE_CONFIG.CACHE_VERSION}`;

  return {
    persistClient: async (client: PersistedClient) => {
      await set(key, client);
    },
    restoreClient: async () => {
      const client = await get<PersistedClient>(key);
      return client ?? undefined;
    },
    removeClient: async () => {
      await del(key);
    },
  };
}

/**
 * Determines if a query should be persisted based on its key.
 * Excludes real-time data (timers) and sensitive data (invites).
 */
export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const keyPrefix = queryKey[0];
  if (typeof keyPrefix !== "string") return true;

  return !CACHE_CONFIG.EXCLUDED_PREFIXES.some((prefix) => keyPrefix === prefix);
}
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/query/persister.ts
git commit -m "feat(cache): add IndexedDB persister for React Query"
```

---

## Task 4: Create Network Status Hook

**Files:**

- Create: `src/hooks/use-network-status.ts`

**Step 1: Create the hook file**

```typescript
"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function getServerSnapshot() {
  // Assume online during SSR
  return true;
}

/**
 * Hook to track browser online/offline status.
 * Uses useSyncExternalStore for SSR-safe subscription.
 */
export function useNetworkStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/use-network-status.ts
git commit -m "feat(hooks): add useNetworkStatus for online/offline detection"
```

---

## Task 5: Create Cache Status Context

**Files:**

- Create: `src/components/status/cache-status-context.tsx`

**Step 1: Create the context file**

```typescript
"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useNetworkStatus } from "@/hooks/use-network-status";

export type CacheStatus = "live" | "stale" | "offline";

interface CacheStatusContextValue {
  status: CacheStatus;
  isOnline: boolean;
  isFetching: boolean;
}

const CacheStatusContext = createContext<CacheStatusContextValue | null>(null);

interface CacheStatusProviderProps {
  children: ReactNode;
}

export function CacheStatusProvider({ children }: CacheStatusProviderProps) {
  const isOnline = useNetworkStatus();
  const fetchingCount = useIsFetching();
  const isFetching = fetchingCount > 0;

  // Track if we've completed initial fetch after hydration
  const [hasInitialData, setHasInitialData] = useState(false);

  useEffect(() => {
    // After first successful fetch cycle, mark as having initial data
    if (!isFetching && isOnline) {
      setHasInitialData(true);
    }
  }, [isFetching, isOnline]);

  const status: CacheStatus = useMemo(() => {
    if (!isOnline) return "offline";
    if (isFetching || !hasInitialData) return "stale";
    return "live";
  }, [isOnline, isFetching, hasInitialData]);

  const value = useMemo(
    () => ({
      status,
      isOnline,
      isFetching,
    }),
    [status, isOnline, isFetching]
  );

  return (
    <CacheStatusContext.Provider value={value}>
      {children}
    </CacheStatusContext.Provider>
  );
}

export function useCacheStatus(): CacheStatusContextValue {
  const context = useContext(CacheStatusContext);
  if (!context) {
    throw new Error("useCacheStatus must be used within CacheStatusProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/status/cache-status-context.tsx
git commit -m "feat(status): add CacheStatusProvider context"
```

---

## Task 6: Create Cache Status Indicator Component

**Files:**

- Create: `src/components/status/cache-status-indicator.tsx`

**Step 1: Create the indicator component**

```typescript
"use client";

import { useCacheStatus, type CacheStatus } from "./cache-status-context";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusConfig: Record<
  CacheStatus,
  {
    color: string;
    label: string;
    description: string;
  }
> = {
  live: {
    color: "bg-[oklch(var(--status-success))]",
    label: "Live",
    description: "Connected with fresh data",
  },
  stale: {
    color: "bg-[oklch(var(--status-warning))]",
    label: "Updating",
    description: "Showing cached data, refreshing in background",
  },
  offline: {
    color: "bg-[oklch(var(--status-error))]",
    label: "Offline",
    description: "No network connection, showing cached data",
  },
};

interface CacheStatusIndicatorProps {
  className?: string;
}

export function CacheStatusIndicator({ className }: CacheStatusIndicatorProps) {
  const { status, isFetching } = useCacheStatus();
  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "fixed bottom-4 right-4 z-50",
              "flex items-center gap-2 rounded-full px-3 py-1.5",
              "bg-card/80 backdrop-blur-sm border shadow-sm",
              "transition-all duration-300 ease-in-out",
              className
            )}
          >
            <span className="relative flex size-2.5">
              {isFetching && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    config.color
                  )}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex size-2.5 rounded-full",
                  config.color
                )}
              />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {config.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/status/cache-status-indicator.tsx
git commit -m "feat(status): add CacheStatusIndicator component"
```

---

## Task 7: Create Status Module Exports

**Files:**

- Create: `src/components/status/index.ts`

**Step 1: Create the barrel export file**

```typescript
export {
  CacheStatusProvider,
  useCacheStatus,
  type CacheStatus,
} from "./cache-status-context";
export { CacheStatusIndicator } from "./cache-status-indicator";
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/status/index.ts
git commit -m "feat(status): add barrel exports for status module"
```

---

## Task 8: Update Query Provider with Persistence

**Files:**

- Modify: `src/components/providers/query-provider.tsx`

**Step 1: Replace the entire file content**

```typescript
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  createIndexedDBPersister,
  shouldPersistQuery,
} from "@/lib/query/persister";
import { CACHE_CONFIG } from "@/lib/query/cache-config";
import {
  CacheStatusProvider,
  CacheStatusIndicator,
} from "@/components/status";

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [mounted, setMounted] = useState(false);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: CACHE_CONFIG.DEFAULT_STALE_TIME,
            gcTime: CACHE_CONFIG.MAX_AGE,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: (failureCount) => {
              if (typeof navigator !== "undefined" && !navigator.onLine) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  const [persister] = useState(() => createIndexedDBPersister());

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/hydration, render nothing to avoid mismatch
  if (!mounted) {
    return null;
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: CACHE_CONFIG.MAX_AGE,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey),
        },
        buster: String(CACHE_CONFIG.CACHE_VERSION),
      }}
    >
      <CacheStatusProvider>
        {children}
        <CacheStatusIndicator />
      </CacheStatusProvider>
    </PersistQueryClientProvider>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Verify lint passes**

Run:

```bash
pnpm lint
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/providers/query-provider.tsx
git commit -m "feat(cache): integrate IndexedDB persistence with status indicator"
```

---

## Task 9: Manual Testing

**Step 1: Start development server**

Run:

```bash
pnpm dev
```

Expected: Server starts on http://localhost:3000

**Step 2: Verify indicator appears**

Open browser to http://localhost:3000, navigate to calendar.
Expected: See green "Live" indicator at bottom-right after data loads.

**Step 3: Test stale behavior**

Reload the page (Ctrl+R / Cmd+R).
Expected: See amber "Updating" indicator briefly, then green "Live" after refresh completes.

**Step 4: Test offline behavior**

Open DevTools > Network tab, set to "Offline". Reload page.
Expected: See red "Offline" indicator, cached data still displayed.

**Step 5: Verify cache persistence**

Go online, load data, close tab completely, reopen.
Expected: Data appears instantly (no skeleton), indicator shows "Updating" then "Live".

---

## Task 10: Final Verification

**Step 1: Run full type check**

Run:

```bash
pnpm typecheck
```

Expected: No errors

**Step 2: Run linter**

Run:

```bash
pnpm lint
```

Expected: No errors

**Step 3: Run tests**

Run:

```bash
pnpm test:run
```

Expected: All tests pass

**Step 4: Create final commit if any fixes were made**

```bash
git status
# If changes exist:
git add -A
git commit -m "fix: address issues from final verification"
```
