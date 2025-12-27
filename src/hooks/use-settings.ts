"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { LinkedGoogleAccount } from "@/types/accounts";

interface Device {
  id: string;
  name: string;
  displayName: string;
  createdAt: string;
  lastActiveAt: string;
}

interface Calendar {
  id: string;
  name: string;
  color: string | null;
  syncEnabled: boolean;
  isPrivate: boolean;
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
      apiFetch<{ accounts: LinkedGoogleAccount[] }>(
        "/api/v1/accounts/linked"
      ).then((data) => data.accounts),
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
      apiFetch<{ calendars: Calendar[] }>(
        `/api/v1/accounts/${accountId}/calendars`
      ).then((data) => data.calendars),
    enabled: !!accountId,
  });
}

export function useUpdateCalendarPrivacy(accountId?: string) {
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
      // Invalidate the specific account's calendars if accountId provided
      if (accountId) {
        queryClient.invalidateQueries({
          queryKey: settingsKeys.calendars(accountId),
        });
      }
      queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

export function useAccountErrors() {
  const { data: accounts } = useLinkedAccounts();

  const accountsWithErrors =
    accounts?.filter((account) => account.lastSyncError !== null) ?? [];

  return {
    hasErrors: accountsWithErrors.length > 0,
    errorCount: accountsWithErrors.length,
    accountsWithErrors,
  };
}
