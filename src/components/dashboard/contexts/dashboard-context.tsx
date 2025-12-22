"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type {
  DashboardData,
  DashboardEvent,
  Timer,
  FamilyMemberStar,
  QuickAction,
} from "../types";
import { useClock } from "../hooks";

interface IDashboardContext {
  familyName: string;
  currentTime: Date;
  todaysEvents: DashboardEvent[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
  nowEvent: DashboardEvent | null;
  nextEvent: DashboardEvent | null;
  laterEvents: DashboardEvent[];
  eventsRemaining: number;
  startQuickAction: (actionId: string) => void;
  pauseTimer: (timerId: string) => void;
  extendTimer: (timerId: string, seconds: number) => void;
}

const DashboardContext = createContext<IDashboardContext | null>(null);

interface DashboardProviderProps {
  data: DashboardData;
  children: ReactNode;
}

export function DashboardProvider({ data, children }: DashboardProviderProps) {
  const currentTime = useClock();
  const [timers, setTimers] = useState(data.activeTimers);

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

  const startQuickAction = (actionId: string) => {
    const action = data.quickActions.find((a) => a.id === actionId);
    if (action?.timerDuration) {
      const newTimer: Timer = {
        id: `timer-${Date.now()}`,
        title: action.label,
        subtitle: "Quick Action",
        remainingSeconds: action.timerDuration,
        totalSeconds: action.timerDuration,
        category: action.category,
      };
      setTimers((prev) => [...prev, newTimer]);
    }
  };

  const pauseTimer = (timerId: string) => {
    // Mock implementation - would integrate with real timer system
    console.log("Pause timer:", timerId);
  };

  const extendTimer = (timerId: string, seconds: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === timerId
          ? {
              ...t,
              remainingSeconds: t.remainingSeconds + seconds,
              totalSeconds: t.totalSeconds + seconds,
            }
          : t
      )
    );
  };

  const value: IDashboardContext = {
    familyName: data.familyName,
    currentTime,
    todaysEvents: data.todaysEvents,
    activeTimers: timers,
    familyMembers: data.familyMembers,
    quickActions: data.quickActions,
    ...categorizedEvents,
    startQuickAction,
    pauseTimer,
    extendTimer,
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
