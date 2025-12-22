"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventWithParticipants } from "@/server/services/event-service";
import type {
  CreateEventInput,
  UpdateEventInput,
} from "@/lib/validations/event";

interface EventsQueryParams {
  startDate?: Date;
  endDate?: Date;
  participantIds?: string[];
  colors?: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchEvents(
  familyId: string,
  params?: EventsQueryParams
): Promise<EventWithParticipants[]> {
  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set("startDate", params.startDate.toISOString());
  }
  if (params?.endDate) {
    searchParams.set("endDate", params.endDate.toISOString());
  }
  if (params?.participantIds) {
    params.participantIds.forEach((id) =>
      searchParams.append("participantIds", id)
    );
  }
  if (params?.colors) {
    params.colors.forEach((color) => searchParams.append("colors", color));
  }

  const response = await fetch(
    `/api/v1/families/${familyId}/events?${searchParams.toString()}`
  );
  const json: ApiResponse<{ events: EventWithParticipants[] }> =
    await response.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch events");
  }

  return json.data?.events ?? [];
}

export function useEvents(familyId: string, params?: EventsQueryParams) {
  return useQuery({
    queryKey: ["events", familyId, params],
    queryFn: () => fetchEvents(familyId, params),
    enabled: !!familyId,
  });
}

export function useEvent(familyId: string, eventId: string) {
  return useQuery({
    queryKey: ["events", familyId, eventId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`
      );
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to fetch event");
      }

      return json.data?.event;
    },
    enabled: !!familyId && !!eventId,
  });
}

export function useCreateEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const response = await fetch(`/api/v1/families/${familyId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to create event");
      }

      return json.data?.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}

export function useUpdateEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      ...input
    }: Partial<CreateEventInput> & { eventId: string }) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to update event");
      }

      return json.data?.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}

export function useDeleteEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`,
        { method: "DELETE" }
      );
      const json: ApiResponse<void> = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}
