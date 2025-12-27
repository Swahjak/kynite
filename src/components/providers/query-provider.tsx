"use client";

import { useState, useEffect, type ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  createIndexedDBPersister,
  shouldPersistQuery,
} from "@/lib/query/persister";
import { CACHE_CONFIG } from "@/lib/query/cache-config";
import { CacheStatusProvider } from "@/components/status";

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
      <CacheStatusProvider>{children}</CacheStatusProvider>
    </PersistQueryClientProvider>
  );
}
