# React Query Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all plain `fetch` calls with TanStack Query (react-query) for consistent data fetching, caching, and mutations across the application.

**Architecture:** Create domain-specific hook files (`use-{domain}.ts`) following the established pattern in `use-events.ts`. Each hook file exports `useQuery` for reads and `useMutation` for writes. Contexts will be simplified to hold only local UI state, delegating data fetching to hooks. A shared API utility will standardize fetch calls with proper error handling.

**Tech Stack:** TanStack Query v5 (already installed), TypeScript, Next.js App Router

---

## Scope Summary

**Files to convert:** ~65 fetch calls across 18 files

**Excluded (server-side, no conversion needed):**

- `src/server/services/google-token-service.ts` - OAuth token refresh
- `src/server/services/google-calendar-client.ts` - Google Calendar API

**Already using react-query (reference implementations):**

- `src/hooks/use-events.ts` - complete pattern to follow
- `src/components/dashboard/contexts/dashboard-context.tsx` - partial adoption

---

## Phase 1: Create Shared API Utilities

### Task 1.1: Create API Fetch Wrapper

**Files:**

- Create: `src/lib/api.ts`
- Test: `src/lib/__tests__/api.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/api.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "../api";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data on successful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { id: "123" } }),
    });

    const result = await apiFetch("/api/test");
    expect(result).toEqual({ id: "123" });
  });

  it("throws ApiError on unsuccessful response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          success: false,
          error: { code: "NOT_FOUND", message: "Resource not found" },
        }),
    });

    await expect(apiFetch("/api/test")).rejects.toThrow(ApiError);
    await expect(apiFetch("/api/test")).rejects.toThrow("Resource not found");
  });

  it("includes Content-Type header for POST/PUT/PATCH", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    await apiFetch("/api/test", { method: "POST", body: JSON.stringify({}) });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/test",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/__tests__/api.test.ts`
Expected: FAIL with "apiFetch is not defined"

**Step 3: Write minimal implementation**

```typescript
// src/lib/api.ts

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
  };

  // Add Content-Type for mutating requests
  if (["POST", "PUT", "PATCH"].includes(options.method ?? "GET")) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  const response = await fetch(url, { ...options, headers });
  const json: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: { code: "PARSE_ERROR", message: `HTTP ${response.status}` },
  }));

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error?.message ?? `HTTP ${response.status}`,
      json.error?.code ?? "UNKNOWN_ERROR",
      response.status
    );
  }

  return json.data as T;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/__tests__/api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/api.ts src/lib/__tests__/api.test.ts
git commit -m "feat(api): add shared apiFetch wrapper with error handling"
```

---

## Phase 2: Create Domain Hooks

### Task 2.1: Create Chores Hooks

**Files:**

- Create: `src/hooks/use-chores.ts`
- Test: `src/hooks/__tests__/use-chores.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-chores.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useChores, useCompleteChore, useCreateChore } from "../use-chores";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useChores", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches chores for a family", async () => {
    const mockChores = [{ id: "1", title: "Clean room" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { chores: mockChores } }),
    });

    const { result } = renderHook(() => useChores("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChores);
  });
});

describe("useCompleteChore", () => {
  it("completes a chore and invalidates cache", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: {} }),
    });

    const { result } = renderHook(() => useCompleteChore("family-123"), {
      wrapper: createWrapper(),
    });

    result.current.mutate("chore-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/families/family-123/chores/chore-1/complete",
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-chores.test.ts`
Expected: FAIL with "useChores is not defined"

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-chores.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { IChoreWithAssignee, IChoreProgress } from "@/types/chore";
import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/lib/validations/chore";

// Query keys factory
export const choreKeys = {
  all: ["chores"] as const,
  family: (familyId: string) => [...choreKeys.all, familyId] as const,
  list: (familyId: string, status?: string) =>
    [...choreKeys.family(familyId), "list", status] as const,
  progress: (familyId: string) =>
    [...choreKeys.family(familyId), "progress"] as const,
};

export function useChores(familyId: string, status?: string) {
  return useQuery({
    queryKey: choreKeys.list(familyId, status),
    queryFn: () =>
      apiFetch<{ chores: IChoreWithAssignee[] }>(
        `/api/v1/families/${familyId}/chores${status ? `?status=${status}` : ""}`
      ).then((data) => data.chores),
    enabled: !!familyId,
  });
}

export function useChoreProgress(familyId: string) {
  return useQuery({
    queryKey: choreKeys.progress(familyId),
    queryFn: () =>
      apiFetch<{ progress: IChoreProgress }>(
        `/api/v1/families/${familyId}/chores/progress`
      ).then((data) => data.progress),
    enabled: !!familyId,
  });
}

export function useCompleteChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: string) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${choreId}/complete`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useCreateChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChoreInput) =>
      apiFetch(`/api/v1/families/${familyId}/chores`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useUpdateChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChoreInput }) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useDeleteChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-chores.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-chores.ts src/hooks/__tests__/use-chores.test.ts
git commit -m "feat(hooks): add react-query hooks for chores"
```

---

### Task 2.2: Create Reward Chart Hooks

**Files:**

- Create: `src/hooks/use-reward-chart.ts`
- Test: `src/hooks/__tests__/use-reward-chart.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-reward-chart.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRewardChartWeek, useCompleteTask } from "../use-reward-chart";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRewardChartWeek", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches weekly chart data", async () => {
    const mockData = { childName: "Test", weekStart: "2025-01-01" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockData }),
    });

    const { result } = renderHook(
      () => useRewardChartWeek("family-123", "chart-456"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-reward-chart.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-reward-chart.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
  CreateTaskInput,
  UpdateTaskInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "@/components/reward-chart/interfaces";

// Query keys factory
export const rewardChartKeys = {
  all: ["rewardChart"] as const,
  family: (familyId: string) => [...rewardChartKeys.all, familyId] as const,
  chart: (familyId: string, chartId: string) =>
    [...rewardChartKeys.family(familyId), chartId] as const,
  week: (familyId: string, chartId: string) =>
    [...rewardChartKeys.chart(familyId, chartId), "week"] as const,
};

export function useRewardChartWeek(familyId: string, chartId: string) {
  return useQuery({
    queryKey: rewardChartKeys.week(familyId, chartId),
    queryFn: () =>
      apiFetch<WeeklyChartData>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/week`
      ),
    enabled: !!familyId && !!chartId,
  });
}

export function useCompleteTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<CompleteTaskResponse>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/complete`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUndoTaskCompletion(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<UndoCompletionResponse>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/undo`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts/${chartId}/tasks`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUpdateTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        { method: "PUT", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useDeleteTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useReorderTasks(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskIds: string[]) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/reorder`,
        { method: "POST", body: JSON.stringify({ taskIds }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateGoal(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGoalInput) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts/${chartId}/goals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUpdateGoal(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: string;
      input: UpdateGoalInput;
    }) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/goals/${goalId}`,
        { method: "PUT", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useSendChartMessage(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/messages`,
        { method: "POST", body: JSON.stringify({ content }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateRewardChart(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.family(familyId),
      });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-reward-chart.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-reward-chart.ts src/hooks/__tests__/use-reward-chart.test.ts
git commit -m "feat(hooks): add react-query hooks for reward chart"
```

---

### Task 2.3: Create Reward Store Hooks

**Files:**

- Create: `src/hooks/use-rewards.ts`
- Test: `src/hooks/__tests__/use-rewards.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-rewards.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRewards, useCreateReward } from "../use-rewards";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useRewards", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches rewards for a family", async () => {
    const mockRewards = [{ id: "1", title: "Ice cream" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { rewards: mockRewards } }),
    });

    const { result } = renderHook(() => useRewards("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRewards);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-rewards.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-rewards.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  CreateRewardInput,
  UpdateRewardInput,
} from "@/lib/validations/reward";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  starCost: number;
  isActive: boolean;
}

interface MemberStars {
  memberId: string;
  memberName: string;
  totalStars: number;
  weeklyStars: number;
}

// Query keys factory
export const rewardKeys = {
  all: ["rewards"] as const,
  family: (familyId: string) => [...rewardKeys.all, familyId] as const,
  list: (familyId: string) => [...rewardKeys.family(familyId), "list"] as const,
  stars: (familyId: string) =>
    [...rewardKeys.family(familyId), "stars"] as const,
  redemptions: (familyId: string) =>
    [...rewardKeys.family(familyId), "redemptions"] as const,
};

export function useRewards(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.list(familyId),
    queryFn: () =>
      apiFetch<{ rewards: Reward[] }>(
        `/api/v1/families/${familyId}/rewards`
      ).then((data) => data.rewards),
    enabled: !!familyId,
  });
}

export function useMemberStars(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.stars(familyId),
    queryFn: () =>
      apiFetch<{ members: MemberStars[] }>(
        `/api/v1/families/${familyId}/rewards/stars`
      ).then((data) => data.members),
    enabled: !!familyId,
  });
}

export function useRedemptions(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.redemptions(familyId),
    queryFn: () =>
      apiFetch<{ redemptions: unknown[] }>(
        `/api/v1/families/${familyId}/rewards/redemptions`
      ).then((data) => data.redemptions),
    enabled: !!familyId,
  });
}

export function useCreateReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRewardInput) =>
      apiFetch(`/api/v1/families/${familyId}/rewards`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useUpdateReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRewardInput }) =>
      apiFetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useDeleteReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useRedeemReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rewardId,
      memberId,
    }: {
      rewardId: string;
      memberId: string;
    }) =>
      apiFetch(`/api/v1/families/${familyId}/rewards/${rewardId}/redeem`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-rewards.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-rewards.ts src/hooks/__tests__/use-rewards.test.ts
git commit -m "feat(hooks): add react-query hooks for rewards"
```

---

### Task 2.4: Create Timers Hooks

**Files:**

- Create: `src/hooks/use-timers.ts`
- Test: `src/hooks/__tests__/use-timers.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-timers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTimerTemplates, useStartTimer } from "../use-timers";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useTimerTemplates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches timer templates", async () => {
    const mockTemplates = [{ id: "1", title: "Screen Time" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { templates: mockTemplates } }),
    });

    const { result } = renderHook(() => useTimerTemplates(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTemplates);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-timers.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-timers.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { TimerTemplate, ActiveTimer } from "@/server/schema";

// Query keys factory
export const timerKeys = {
  all: ["timers"] as const,
  templates: () => [...timerKeys.all, "templates"] as const,
  active: () => [...timerKeys.all, "active"] as const,
};

export function useTimerTemplates() {
  return useQuery({
    queryKey: timerKeys.templates(),
    queryFn: () =>
      apiFetch<{ templates: TimerTemplate[] }>("/api/v1/timers/templates").then(
        (data) => data.templates
      ),
  });
}

export function useActiveTimers() {
  return useQuery({
    queryKey: timerKeys.active(),
    queryFn: () =>
      apiFetch<{ timers: ActiveTimer[] }>("/api/v1/timers/active").then(
        (data) => data.timers
      ),
    staleTime: Infinity, // Real-time updates via Pusher
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      templateId: string;
      assignedToId?: string;
      deviceId?: string;
    }) =>
      apiFetch("/api/v1/timers/active", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.active() });
    },
  });
}

export function useCreateTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<TimerTemplate>) =>
      apiFetch("/api/v1/timers/templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}

export function useUpdateTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<TimerTemplate>;
    }) =>
      apiFetch(`/api/v1/timers/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}

export function useDeleteTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/timers/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-timers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-timers.ts src/hooks/__tests__/use-timers.test.ts
git commit -m "feat(hooks): add react-query hooks for timers"
```

---

### Task 2.5: Create Family Hooks

**Files:**

- Create: `src/hooks/use-family.ts`
- Test: `src/hooks/__tests__/use-family.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-family.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCreateFamily, useAddChild, useCreateInvite } from "../use-family";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useCreateFamily", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a family", async () => {
    const mockFamily = { id: "fam-1", name: "Test Family" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { family: mockFamily } }),
    });

    const { result } = renderHook(() => useCreateFamily(), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ name: "Test Family" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-family.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-family.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface FamilyMember {
  id: string;
  name: string;
  avatarColor: string;
}

// Query keys factory
export const familyKeys = {
  all: ["family"] as const,
  detail: (familyId: string) => [...familyKeys.all, familyId] as const,
  children: (familyId: string) =>
    [...familyKeys.detail(familyId), "children"] as const,
  invites: (familyId: string) =>
    [...familyKeys.detail(familyId), "invites"] as const,
};

export function useCreateFamily() {
  return useMutation({
    mutationFn: (input: { name: string }) =>
      apiFetch<{ family: { id: string } }>("/api/v1/families", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useUpdateFamily(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string }) =>
      apiFetch(`/api/v1/families/${familyId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    },
  });
}

export function useAddChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; avatarColor?: string }) =>
      apiFetch(`/api/v1/families/${familyId}/children`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useUpdateChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      input,
    }: {
      childId: string;
      input: { name?: string; avatarColor?: string; avatarSvg?: string };
    }) =>
      apiFetch(`/api/v1/families/${familyId}/children/${childId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useDeleteChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (childId: string) =>
      apiFetch(`/api/v1/families/${familyId}/children/${childId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useCreateInvite(familyId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ invite: { token: string; expiresAt: string } }>(
        `/api/v1/families/${familyId}/invites`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch(`/api/v1/invites/${token}/accept`, { method: "POST" }),
  });
}

export function useInviteDetails(token: string) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () => apiFetch<{ invite: unknown }>(`/api/v1/invites/${token}`),
    enabled: !!token,
  });
}

export function useGenerateUpgradeToken(familyId: string) {
  return useMutation({
    mutationFn: (childMemberId: string) =>
      apiFetch<{ upgradeToken: string }>(
        `/api/v1/families/${familyId}/children/${childMemberId}/upgrade-token`,
        { method: "POST" }
      ),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-family.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-family.ts src/hooks/__tests__/use-family.test.ts
git commit -m "feat(hooks): add react-query hooks for family management"
```

---

### Task 2.6: Create Settings Hooks

**Files:**

- Create: `src/hooks/use-settings.ts`
- Test: `src/hooks/__tests__/use-settings.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-settings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLinkedAccounts, useDevices } from "../use-settings";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLinkedAccounts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches linked accounts", async () => {
    const mockAccounts = [{ id: "1", provider: "google" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { accounts: mockAccounts } }),
    });

    const { result } = renderHook(() => useLinkedAccounts(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAccounts);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-settings.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-settings.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface LinkedAccount {
  id: string;
  provider: string;
  email: string;
}

interface Device {
  id: string;
  name: string;
  lastActiveAt: string;
}

// Query keys factory
export const settingsKeys = {
  all: ["settings"] as const,
  linkedAccounts: () => [...settingsKeys.all, "linkedAccounts"] as const,
  devices: () => [...settingsKeys.all, "devices"] as const,
  calendars: (accountId: string) =>
    [...settingsKeys.all, "calendars", accountId] as const,
};

export function useLinkedAccounts() {
  return useQuery({
    queryKey: settingsKeys.linkedAccounts(),
    queryFn: () =>
      apiFetch<{ accounts: LinkedAccount[] }>("/api/v1/accounts/linked").then(
        (data) => data.accounts
      ),
  });
}

export function useUnlinkAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) =>
      apiFetch(`/api/v1/accounts/linked/${accountId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: settingsKeys.linkedAccounts(),
      });
    },
  });
}

export function useDevices() {
  return useQuery({
    queryKey: settingsKeys.devices(),
    queryFn: () =>
      apiFetch<{ devices: Device[] }>("/api/v1/devices").then(
        (data) => data.devices
      ),
  });
}

export function useGeneratePairingCode() {
  return useMutation({
    mutationFn: (deviceName: string) =>
      apiFetch<{ code: string }>("/api/v1/devices/pair/generate", {
        method: "POST",
        body: JSON.stringify({ deviceName }),
      }),
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name: string } }) =>
      apiFetch(`/api/v1/devices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.devices() });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/devices/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.devices() });
    },
  });
}

export function useAccountCalendars(accountId: string) {
  return useQuery({
    queryKey: settingsKeys.calendars(accountId),
    queryFn: () =>
      apiFetch<{ calendars: unknown[] }>(
        `/api/v1/accounts/${accountId}/calendars`
      ).then((data) => data.calendars),
    enabled: !!accountId,
  });
}

export function useUpdateCalendarPrivacy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      calendarId,
      hideDetails,
    }: {
      calendarId: string;
      hideDetails: boolean;
    }) =>
      apiFetch(`/api/v1/calendars/${calendarId}/privacy`, {
        method: "PUT",
        body: JSON.stringify({ hideDetails }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-settings.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-settings.ts src/hooks/__tests__/use-settings.test.ts
git commit -m "feat(hooks): add react-query hooks for settings"
```

---

### Task 2.7: Create Calendar Sync Hooks

**Files:**

- Create: `src/hooks/use-calendar-sync.ts`
- Test: `src/hooks/__tests__/use-calendar-sync.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-calendar-sync.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFamilyCalendars, useAddCalendar } from "../use-calendar-sync";

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useFamilyCalendars", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches family calendars", async () => {
    const mockCalendars = [{ id: "1", name: "Main Calendar" }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { calendars: mockCalendars } }),
    });

    const { result } = renderHook(() => useFamilyCalendars("family-123"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCalendars);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/__tests__/use-calendar-sync.test.ts`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-calendar-sync.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface AvailableCalendar {
  id: string;
  summary: string;
  primary: boolean;
}

interface LinkedCalendar {
  id: string;
  googleCalendarId: string;
  googleCalendarName: string;
  syncEnabled: boolean;
  colorOverride: string | null;
}

// Query keys factory
export const calendarSyncKeys = {
  all: ["calendarSync"] as const,
  family: (familyId: string) => [...calendarSyncKeys.all, familyId] as const,
  available: (familyId: string, accountId: string) =>
    [...calendarSyncKeys.family(familyId), "available", accountId] as const,
  linked: (familyId: string) =>
    [...calendarSyncKeys.family(familyId), "linked"] as const,
};

export function useAvailableCalendars(familyId: string, accountId: string) {
  return useQuery({
    queryKey: calendarSyncKeys.available(familyId, accountId),
    queryFn: () =>
      apiFetch<{ calendars: AvailableCalendar[] }>(
        `/api/v1/families/${familyId}/calendars/available/${accountId}`
      ).then((data) => data.calendars),
    enabled: !!familyId && !!accountId,
  });
}

export function useFamilyCalendars(familyId: string) {
  return useQuery({
    queryKey: calendarSyncKeys.linked(familyId),
    queryFn: () =>
      apiFetch<{ calendars: LinkedCalendar[] }>(
        `/api/v1/families/${familyId}/calendars`
      ).then((data) => data.calendars),
    enabled: !!familyId,
  });
}

export function useAddCalendar(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      accountId: string;
      googleCalendarId: string;
      googleCalendarName: string;
    }) =>
      apiFetch(`/api/v1/families/${familyId}/calendars`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarSyncKeys.family(familyId),
      });
    },
  });
}

export function useRemoveCalendar(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (calendarId: string) =>
      apiFetch(`/api/v1/families/${familyId}/calendars/${calendarId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarSyncKeys.family(familyId),
      });
    },
  });
}

export function useSyncCalendar(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (calendarId: string) =>
      apiFetch(`/api/v1/families/${familyId}/calendars/${calendarId}/sync`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSyncAllCalendars(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (calendarIds: string[]) => {
      for (const id of calendarIds) {
        await apiFetch(`/api/v1/families/${familyId}/calendars/${id}/sync`, {
          method: "POST",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test src/hooks/__tests__/use-calendar-sync.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-calendar-sync.ts src/hooks/__tests__/use-calendar-sync.test.ts
git commit -m "feat(hooks): add react-query hooks for calendar sync"
```

---

## Phase 3: Refactor Contexts to Use Hooks

### Task 3.1: Refactor ChoresContext

**Files:**

- Modify: `src/components/chores/contexts/chores-context.tsx`

**Step 1: Update imports and remove fetch logic**

Replace the entire file with:

```typescript
// src/components/chores/contexts/chores-context.tsx
"use client";

import { createContext, useContext, useState } from "react";
import type { IChoreWithAssignee, IChoreProgress, ChoreViewFilter } from "@/types/chore";
import type { FamilyMemberWithUser } from "@/types/family";
import {
  useChores,
  useChoreProgress,
  useCompleteChore,
  useCreateChore,
  useUpdateChore,
  useDeleteChore,
} from "@/hooks/use-chores";
import type { CreateChoreInput, UpdateChoreInput } from "@/lib/validations/chore";

interface ChoresContextValue {
  chores: IChoreWithAssignee[];
  members: FamilyMemberWithUser[];
  progress: IChoreProgress;
  currentView: ChoreViewFilter;
  setCurrentView: (view: ChoreViewFilter) => void;
  selectedPersonId: string | "all";
  setSelectedPersonId: (id: string | "all") => void;
  completeChore: (choreId: string) => Promise<void>;
  isLoading: boolean;
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
  createChore: (input: CreateChoreInput) => Promise<void>;
  updateChore: (id: string, input: UpdateChoreInput) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
}

const ChoresContext = createContext<ChoresContextValue | null>(null);

interface ChoresProviderProps {
  children: React.ReactNode;
  familyId: string;
  initialChores: IChoreWithAssignee[];
  initialProgress: IChoreProgress;
  members: FamilyMemberWithUser[];
}

export function ChoresProvider({
  children,
  familyId,
  initialChores,
  initialProgress,
  members,
}: ChoresProviderProps) {
  const [currentView, setCurrentView] = useState<ChoreViewFilter>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | "all">("all");
  const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);

  // React Query hooks
  const { data: chores = initialChores, isLoading: isLoadingChores } = useChores(
    familyId,
    "pending"
  );
  const { data: progress = initialProgress } = useChoreProgress(familyId);

  const completechoreMutation = useCompleteChore(familyId);
  const createChoreMutation = useCreateChore(familyId);
  const updateChoreMutation = useUpdateChore(familyId);
  const deleteChoreMutation = useDeleteChore(familyId);

  const completeChore = async (choreId: string) => {
    await completechoreMutation.mutateAsync(choreId);
  };

  const createChore = async (input: CreateChoreInput) => {
    await createChoreMutation.mutateAsync(input);
  };

  const updateChore = async (id: string, input: UpdateChoreInput) => {
    await updateChoreMutation.mutateAsync({ id, input });
  };

  const deleteChore = async (id: string) => {
    setExpandedChoreId(null);
    await deleteChoreMutation.mutateAsync(id);
  };

  const value: ChoresContextValue = {
    chores,
    members,
    progress,
    currentView,
    setCurrentView,
    selectedPersonId,
    setSelectedPersonId,
    completeChore,
    isLoading: isLoadingChores,
    expandedChoreId,
    setExpandedChoreId,
    createChore,
    updateChore,
    deleteChore,
  };

  return (
    <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>
  );
}

export function useChoresContext(): ChoresContextValue {
  const context = useContext(ChoresContext);
  if (!context) {
    throw new Error("useChoresContext must be used within a ChoresProvider");
  }
  return context;
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/chores/contexts/chores-context.tsx
git commit -m "refactor(chores): migrate context to use react-query hooks"
```

---

### Task 3.2: Refactor RewardChartContext

**Files:**

- Modify: `src/components/reward-chart/contexts/reward-chart-context.tsx`

**Step 1: Update to use react-query hooks**

Replace the entire file with:

```typescript
// src/components/reward-chart/contexts/reward-chart-context.tsx
"use client";

import type React from "react";
import { createContext, useContext, useState } from "react";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
  CreateTaskInput,
  UpdateTaskInput,
  CreateGoalInput,
  UpdateGoalInput,
  ChildChartInfo,
} from "../interfaces";
import {
  useRewardChartWeek,
  useCompleteTask,
  useUndoTaskCompletion,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useCreateGoal,
  useUpdateGoal,
  useSendChartMessage,
} from "@/hooks/use-reward-chart";

interface RewardChartContextValue {
  weekData: WeeklyChartData | null;
  isLoading: boolean;
  error: Error | null;
  completeTask: (taskId: string) => Promise<CompleteTaskResponse | null>;
  undoCompletion: (taskId: string) => Promise<UndoCompletionResponse | null>;
  familyId: string;
  chartId: string;
  isManager: boolean;
  allChildren?: ChildChartInfo[];
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  reorderTasks: (taskIds: string[]) => Promise<void>;
  createGoal: (input: CreateGoalInput) => Promise<void>;
  updateGoal: (goalId: string, input: UpdateGoalInput) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
}

const RewardChartContext = createContext<RewardChartContextValue | undefined>(
  undefined
);

interface RewardChartProviderProps {
  children: React.ReactNode;
  familyId: string;
  chartId: string;
  initialData: WeeklyChartData | null;
  isManager?: boolean;
  allChildren?: ChildChartInfo[];
}

export function RewardChartProvider({
  children,
  familyId,
  chartId,
  initialData,
  isManager = false,
  allChildren,
}: RewardChartProviderProps) {
  // React Query hooks
  const {
    data: weekData = initialData,
    isLoading,
    error,
  } = useRewardChartWeek(familyId, chartId);

  const completeTaskMutation = useCompleteTask(familyId, chartId);
  const undoTaskMutation = useUndoTaskCompletion(familyId, chartId);
  const createTaskMutation = useCreateTask(familyId, chartId);
  const updateTaskMutation = useUpdateTask(familyId, chartId);
  const deleteTaskMutation = useDeleteTask(familyId, chartId);
  const reorderTasksMutation = useReorderTasks(familyId, chartId);
  const createGoalMutation = useCreateGoal(familyId, chartId);
  const updateGoalMutation = useUpdateGoal(familyId, chartId);
  const sendMessageMutation = useSendChartMessage(familyId, chartId);

  const completeTask = async (taskId: string) => {
    try {
      return await completeTaskMutation.mutateAsync(taskId);
    } catch {
      return null;
    }
  };

  const undoCompletion = async (taskId: string) => {
    try {
      return await undoTaskMutation.mutateAsync(taskId);
    } catch {
      return null;
    }
  };

  const createTask = async (input: CreateTaskInput) => {
    await createTaskMutation.mutateAsync(input);
  };

  const updateTask = async (taskId: string, input: UpdateTaskInput) => {
    await updateTaskMutation.mutateAsync({ taskId, input });
  };

  const deleteTask = async (taskId: string) => {
    await deleteTaskMutation.mutateAsync(taskId);
  };

  const reorderTasks = async (taskIds: string[]) => {
    await reorderTasksMutation.mutateAsync(taskIds);
  };

  const createGoal = async (input: CreateGoalInput) => {
    await createGoalMutation.mutateAsync(input);
  };

  const updateGoal = async (goalId: string, input: UpdateGoalInput) => {
    await updateGoalMutation.mutateAsync({ goalId, input });
  };

  const sendMessage = async (content: string) => {
    await sendMessageMutation.mutateAsync(content);
  };

  const value: RewardChartContextValue = {
    weekData,
    isLoading,
    error: error instanceof Error ? error : null,
    completeTask,
    undoCompletion,
    familyId,
    chartId,
    isManager,
    allChildren,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    createGoal,
    updateGoal,
    sendMessage,
  };

  return (
    <RewardChartContext.Provider value={value}>
      {children}
    </RewardChartContext.Provider>
  );
}

export function useRewardChart() {
  const context = useContext(RewardChartContext);
  if (!context) {
    throw new Error("useRewardChart must be used within RewardChartProvider");
  }
  return context;
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/reward-chart/contexts/reward-chart-context.tsx
git commit -m "refactor(reward-chart): migrate context to use react-query hooks"
```

---

### Task 3.3: Refactor RewardStoreContext

**Files:**

- Modify: `src/components/reward-store/contexts/reward-store-context.tsx`

**Step 1: Update to use react-query hooks**

This follows the same pattern as Task 3.1 and 3.2. Replace fetch calls with hook usage.

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/reward-store/contexts/reward-store-context.tsx
git commit -m "refactor(reward-store): migrate context to use react-query hooks"
```

---

## Phase 4: Refactor Standalone Components

### Task 4.1: Refactor timers-page.tsx

**Files:**

- Modify: `src/components/timers/timers-page.tsx`

**Step 1: Replace fetch with hooks**

```typescript
// Replace:
const res = await fetch("/api/v1/timers/templates");

// With:
import {
  useTimerTemplates,
  useStartTimer,
  useDeleteTimerTemplate,
} from "@/hooks/use-timers";

// In component:
const { data: templates, isLoading } = useTimerTemplates();
const startTimerMutation = useStartTimer();
const deleteTemplateMutation = useDeleteTimerTemplate();
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/timers/timers-page.tsx
git commit -m "refactor(timers): use react-query hooks in timers page"
```

---

### Task 4.2: Refactor family components

**Files:**

- Modify: `src/components/family/add-child-dialog.tsx`
- Modify: `src/components/family/family-settings-client.tsx`
- Modify: `src/components/family/onboarding/create-family-form.tsx`
- Modify: `src/components/family/onboarding/invite-members-step.tsx`
- Modify: `src/components/family/invite-link-generator.tsx`
- Modify: `src/components/family/join-family-client.tsx`
- Modify: `src/components/family/upgrade-token-dialog.tsx`

**Step 1: Replace fetch calls with hooks**

Import and use appropriate hooks from `use-family.ts`:

- `useAddChild` for add-child-dialog
- `useUpdateFamily`, `useUpdateChild`, `useDeleteChild` for family-settings-client
- `useCreateFamily` for create-family-form
- `useCreateInvite` for invite-members-step and invite-link-generator
- `useInviteDetails`, `useAcceptInvite` for join-family-client
- `useGenerateUpgradeToken` for upgrade-token-dialog

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/family/
git commit -m "refactor(family): use react-query hooks in family components"
```

---

### Task 4.3: Refactor settings components

**Files:**

- Modify: `src/components/settings/linked-accounts-section.tsx`
- Modify: `src/components/settings/devices-section.tsx`
- Modify: `src/components/settings/account-calendars-list.tsx`

**Step 1: Replace fetch calls with hooks**

Use hooks from `use-settings.ts`:

- `useLinkedAccounts`, `useUnlinkAccount` for linked-accounts-section
- `useDevices`, `useGeneratePairingCode`, `useUpdateDevice`, `useDeleteDevice` for devices-section
- `useAccountCalendars`, `useUpdateCalendarPrivacy` for account-calendars-list

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/settings/
git commit -m "refactor(settings): use react-query hooks in settings components"
```

---

### Task 4.4: Refactor calendar sync components

**Files:**

- Modify: `src/components/sync/calendar-selection-section.tsx`

**Step 1: Replace fetch calls with hooks**

Use hooks from `use-calendar-sync.ts`:

- `useAvailableCalendars`
- `useFamilyCalendars`
- `useAddCalendar`
- `useRemoveCalendar`
- `useSyncAllCalendars`
- `useUpdateCalendarPrivacy`

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/sync/
git commit -m "refactor(sync): use react-query hooks in calendar sync"
```

---

### Task 4.5: Refactor remaining components

**Files:**

- Modify: `src/components/device/device-pair-form.tsx`
- Modify: `src/components/reward-chart/select-member-state.tsx`
- Modify: `src/components/reward-chart/empty-chart-state.tsx`
- Modify: `src/components/reward-chart/reward-chart-page.tsx`
- Modify: `src/app/[locale]/link-account/link-account-client.tsx`

**Step 1: Create hooks for device pairing**

Add to `use-settings.ts`:

```typescript
export function useCompletePairing() {
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch("/api/auth/device/pair/complete", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
  });
}
```

**Step 2: Create hooks for link account**

Create `src/hooks/use-link-account.ts`:

```typescript
export function useLinkAccount() {
  return useMutation({
    mutationFn: (input: { accountId: string; userId: string }) =>
      apiFetch("/api/v1/link-account", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
```

**Step 3: Update components to use hooks**

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/ src/hooks/ src/app/
git commit -m "refactor: complete react-query migration for remaining components"
```

---

## Phase 5: Cleanup and Verification

### Task 5.1: Remove refreshChores and similar patterns

**Files:**

- Search for and remove any remaining `refreshChores`, `refetch` patterns that are now handled by react-query

**Step 1: Search for remaining fetch patterns**

Run: `grep -r "await fetch" src/components --include="*.tsx" --include="*.ts"`
Expected: Only server-side files should have fetch calls

**Step 2: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass

**Step 3: Run E2E tests**

Run: `pnpm e2e`
Expected: All tests pass

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: cleanup remaining fetch patterns after react-query migration"
```

---

## Summary

**Total Tasks:** 15
**Estimated Complexity:** Large refactoring effort

**Files Created:**

- `src/lib/api.ts` - Shared fetch wrapper
- `src/hooks/use-chores.ts`
- `src/hooks/use-reward-chart.ts`
- `src/hooks/use-rewards.ts`
- `src/hooks/use-timers.ts`
- `src/hooks/use-family.ts`
- `src/hooks/use-settings.ts`
- `src/hooks/use-calendar-sync.ts`
- `src/hooks/use-link-account.ts`
- Test files for each hook

**Files Modified:**

- 4 context files
- ~15 component files

**Benefits After Migration:**

- Consistent error handling via `ApiError`
- Automatic cache invalidation
- Deduplication of requests
- Built-in loading/error states
- Background refetching
- Optimistic updates (can be added later)
