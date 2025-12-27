"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface UserPreferences {
  use24HourFormat: boolean;
  locale: string | null;
}

export const preferencesKeys = {
  all: ["preferences"] as const,
  user: () => [...preferencesKeys.all, "user"] as const,
};

export function useUserPreferences() {
  return useQuery({
    queryKey: preferencesKeys.user(),
    queryFn: () =>
      apiFetch<UserPreferences>("/api/v1/preferences").then((data) => data),
    staleTime: Infinity,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<UserPreferences>) =>
      apiFetch<UserPreferences>("/api/v1/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({ queryKey: preferencesKeys.user() });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        preferencesKeys.user()
      );

      queryClient.setQueryData<UserPreferences>(
        preferencesKeys.user(),
        (old) =>
          ({
            ...old,
            ...newPreferences,
          }) as UserPreferences
      );

      return { previousPreferences };
    },
    onError: (_err, _newPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          preferencesKeys.user(),
          context.previousPreferences
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.user() });
    },
  });
}
