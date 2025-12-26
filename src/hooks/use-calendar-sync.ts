"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { GoogleCalendar } from "@/server/schema";

export interface AvailableCalendar {
  id: string;
  name: string;
  color: string;
  accessRole: string;
  primary: boolean;
}

// Query keys factory
export const calendarSyncKeys = {
  all: ["calendarSync"] as const,
  family: (familyId: string) => [...calendarSyncKeys.all, familyId] as const,
  googleCalendars: (accountId: string) =>
    [...calendarSyncKeys.all, "google", accountId] as const,
  linked: (familyId: string) =>
    [...calendarSyncKeys.family(familyId), "linked"] as const,
};

export function useGoogleCalendars(accountId: string) {
  return useQuery({
    queryKey: calendarSyncKeys.googleCalendars(accountId),
    queryFn: () =>
      apiFetch<{ calendars: AvailableCalendar[] }>(
        `/api/v1/google/calendars?accountId=${accountId}`
      ).then((data) => data.calendars),
    enabled: !!accountId,
  });
}

export function useFamilyCalendars(familyId: string) {
  return useQuery({
    queryKey: calendarSyncKeys.linked(familyId),
    queryFn: () =>
      apiFetch<{ calendars: GoogleCalendar[] }>(
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
      name: string;
      color: string;
      accessRole: string;
    }) =>
      apiFetch<{ calendar: GoogleCalendar }>(
        `/api/v1/families/${familyId}/calendars`,
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarSyncKeys.family(familyId),
      });
    },
  });
}

export function useUpdateCalendar(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      calendarId,
      input,
    }: {
      calendarId: string;
      input: { syncEnabled?: boolean };
    }) =>
      apiFetch(`/api/v1/families/${familyId}/calendars/${calendarId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarSyncKeys.family(familyId),
      });
    },
  });
}

export function useUpdateCalendarPrivacy(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      calendarId,
      isPrivate,
    }: {
      calendarId: string;
      isPrivate: boolean;
    }) =>
      apiFetch(`/api/v1/calendars/${calendarId}/privacy`, {
        method: "PATCH",
        body: JSON.stringify({ isPrivate }),
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
