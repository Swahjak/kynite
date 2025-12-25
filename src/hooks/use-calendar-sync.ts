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
