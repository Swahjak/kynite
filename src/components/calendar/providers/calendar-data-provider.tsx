"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  useEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
} from "@/hooks/use-events";
import {
  transformEventToIEvent,
  transformMemberToIUser,
} from "@/components/calendar/requests";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarDataContextValue {
  events: IEvent[];
  users: IUser[];
  isLoading: boolean;
  error: Error | null;
  createEvent: (
    input: Parameters<ReturnType<typeof useCreateEvent>["mutateAsync"]>[0]
  ) => Promise<void>;
  updateEvent: (
    input: Parameters<ReturnType<typeof useUpdateEvent>["mutateAsync"]>[0]
  ) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

const CalendarDataContext = createContext<CalendarDataContextValue | null>(
  null
);

interface CalendarDataProviderProps {
  familyId: string;
  members: Array<{
    id: string;
    displayName: string | null;
    avatarColor: string | null;
    user: { name: string; image: string | null };
  }>;
  children: ReactNode;
}

export function CalendarDataProvider({
  familyId,
  members,
  children,
}: CalendarDataProviderProps) {
  const { data: eventsData, isLoading, error } = useEvents(familyId);
  const createMutation = useCreateEvent(familyId);
  const updateMutation = useUpdateEvent(familyId);
  const deleteMutation = useDeleteEvent(familyId);

  const events = useMemo(
    () => (eventsData ?? []).map(transformEventToIEvent),
    [eventsData]
  );

  const users = useMemo(() => members.map(transformMemberToIUser), [members]);

  const value: CalendarDataContextValue = useMemo(
    () => ({
      events,
      users,
      isLoading,
      error: error as Error | null,
      createEvent: async (input) => {
        await createMutation.mutateAsync(input);
      },
      updateEvent: async (input) => {
        await updateMutation.mutateAsync(input);
      },
      deleteEvent: async (eventId) => {
        await deleteMutation.mutateAsync(eventId);
      },
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    }),
    [
      events,
      users,
      isLoading,
      error,
      createMutation,
      updateMutation,
      deleteMutation,
    ]
  );

  return (
    <CalendarDataContext.Provider value={value}>
      {children}
    </CalendarDataContext.Provider>
  );
}

export function useCalendarData() {
  const context = useContext(CalendarDataContext);
  if (!context) {
    throw new Error(
      "useCalendarData must be used within a CalendarDataProvider"
    );
  }
  return context;
}
