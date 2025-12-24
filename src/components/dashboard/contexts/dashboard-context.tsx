"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  DashboardData,
  DashboardEvent,
  DashboardChore,
  Timer,
  FamilyMemberStar,
  QuickAction,
} from "../types";
import { useClock } from "../hooks";
import { getDeviceId } from "@/hooks/use-timer-countdown";
import { useFamilyChannel } from "@/hooks/use-family-channel";
import type { ActiveTimer } from "@/server/schema";

interface IDashboardContext {
  familyName: string;
  currentTime: Date;
  todaysEvents: DashboardEvent[];
  todaysChores: DashboardChore[];
  choresRemaining: number;
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
  nowEvent: DashboardEvent | null;
  nextEvent: DashboardEvent | null;
  laterEvents: DashboardEvent[];
  eventsRemaining: number;
  startQuickAction: (actionId: string, memberId: string) => void;
  pauseTimer: (timerId: string) => void;
  extendTimer: (timerId: string, seconds: number) => void;
  isLoadingTimers: boolean;
}

const DashboardContext = createContext<IDashboardContext | null>(null);

interface DashboardProviderProps {
  data: DashboardData;
  children: ReactNode;
}

// Transform API timer to dashboard Timer type
function transformTimer(apiTimer: {
  id: string;
  title: string;
  description: string | null;
  remainingSeconds: number;
  durationSeconds: number;
  category: string;
  status: string;
  starReward: number;
  alertMode: string;
  cooldownSeconds: number | null;
  assignedToId: string | null;
  ownerDeviceId: string | null;
}): Timer {
  return {
    id: apiTimer.id,
    title: apiTimer.title,
    subtitle: apiTimer.description || "",
    remainingSeconds: apiTimer.remainingSeconds,
    totalSeconds: apiTimer.durationSeconds,
    category: apiTimer.category,
    status: apiTimer.status as Timer["status"],
    starReward: apiTimer.starReward,
    alertMode: apiTimer.alertMode as Timer["alertMode"],
    cooldownSeconds: apiTimer.cooldownSeconds,
    assignedToId: apiTimer.assignedToId,
    ownerDeviceId: apiTimer.ownerDeviceId,
  };
}

export function DashboardProvider({ data, children }: DashboardProviderProps) {
  const currentTime = useClock();
  const queryClient = useQueryClient();
  const [deviceId, setDeviceId] = useState<string>("");

  // Get device ID on mount
  useEffect(() => {
    setDeviceId(getDeviceId());
  }, []);

  // Fetch active timers from API
  const { data: apiTimers = [], isLoading: isLoadingTimers } = useQuery({
    queryKey: ["activeTimers"],
    queryFn: async () => {
      const res = await fetch("/api/v1/timers/active");
      const data = await res.json();
      return data.success ? data.data.timers : [];
    },
    staleTime: Infinity,
  });

  // Transform API timers to dashboard format
  const timers: Timer[] = useMemo(
    () => apiTimers.map(transformTimer),
    [apiTimers]
  );

  // Pause timer mutation
  const pauseTimerMutation = useMutation({
    mutationFn: async (timerId: string) => {
      const res = await fetch(`/api/v1/timers/active/${timerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", deviceId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimers"] });
    },
  });

  // Extend timer mutation
  const extendTimerMutation = useMutation({
    mutationFn: async ({
      timerId,
      seconds,
    }: {
      timerId: string;
      seconds: number;
    }) => {
      const res = await fetch(`/api/v1/timers/active/${timerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "extend", seconds }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activeTimers"] });
    },
  });

  const categorizedEvents = useMemo(() => {
    const now = currentTime.getTime();
    const upcoming = data.todaysEvents
      .filter((e) => e.endTime.getTime() > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const nowEvent =
      upcoming.find((e) => {
        const start = e.startTime.getTime();
        const end = e.endTime.getTime();
        return now >= start && now < end;
      }) || null;

    const futureEvents = upcoming.filter((e) => e.startTime.getTime() > now);
    const nextEvent = futureEvents[0] || null;
    const laterEvents = futureEvents.slice(1);

    return {
      nowEvent,
      nextEvent,
      laterEvents,
      eventsRemaining: upcoming.length,
    };
  }, [data.todaysEvents, currentTime]);

  const startQuickAction = useCallback(
    async (actionId: string, memberId: string) => {
      const action = data.quickActions.find((a) => a.id === actionId);
      if (action?.timerDuration) {
        // Start timer via API using the template
        await fetch("/api/v1/timers/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: actionId,
            assignedToId: memberId,
            deviceId,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["activeTimers"] });
      }
    },
    [data.quickActions, deviceId, queryClient]
  );

  const pauseTimer = useCallback(
    (timerId: string) => {
      pauseTimerMutation.mutate(timerId);
    },
    [pauseTimerMutation]
  );

  const extendTimer = useCallback(
    (timerId: string, seconds: number) => {
      extendTimerMutation.mutate({ timerId, seconds });
    },
    [extendTimerMutation]
  );

  // Real-time updates via Pusher
  useFamilyChannel(data.familyId, {
    "timer:started": (eventData: unknown) => {
      const { timer } = eventData as { timer: ActiveTimer };
      queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) => [
        ...(old ?? []),
        timer,
      ]);
    },
    "timer:updated": (eventData: unknown) => {
      const { timer } = eventData as { timer: ActiveTimer };
      queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
        (old ?? []).map((t) => (t.id === timer.id ? timer : t))
      );
    },
    "timer:cancelled": (eventData: unknown) => {
      const { timerId } = eventData as { timerId: string };
      queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
        (old ?? []).filter((t) => t.id !== timerId)
      );
    },
    "timer:completed": (eventData: unknown) => {
      const { timer } = eventData as { timer: ActiveTimer };
      queryClient.setQueryData<ActiveTimer[]>(["activeTimers"], (old) =>
        (old ?? []).filter((t) => t.id !== timer.id)
      );
    },
    "timer:expired": (eventData: unknown) => {
      const { timer } = eventData as { timer: ActiveTimer };
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

  const value: IDashboardContext = {
    familyName: data.familyName,
    currentTime,
    todaysEvents: data.todaysEvents,
    todaysChores: data.todaysChores,
    choresRemaining: data.todaysChores.length,
    activeTimers: timers,
    familyMembers: data.familyMembers,
    quickActions: data.quickActions,
    ...categorizedEvents,
    startQuickAction,
    pauseTimer,
    extendTimer,
    isLoadingTimers,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): IDashboardContext {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
