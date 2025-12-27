"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useNetworkStatus } from "@/hooks/use-network-status";

export type CacheStatus = "live" | "stale" | "offline";

interface CacheStatusContextValue {
  status: CacheStatus;
  isOnline: boolean;
  isFetching: boolean;
}

const CacheStatusContext = createContext<CacheStatusContextValue | null>(null);

interface CacheStatusProviderProps {
  children: ReactNode;
}

export function CacheStatusProvider({ children }: CacheStatusProviderProps) {
  const isOnline = useNetworkStatus();
  const fetchingCount = useIsFetching();
  const isFetching = fetchingCount > 0;

  // Track if we've completed initial fetch after hydration
  const [hasInitialData, setHasInitialData] = useState(false);

  useEffect(() => {
    // After first successful fetch cycle, mark as having initial data
    if (!isFetching && isOnline) {
      setHasInitialData(true);
    }
  }, [isFetching, isOnline]);

  const status: CacheStatus = useMemo(() => {
    if (!isOnline) return "offline";
    if (isFetching || !hasInitialData) return "stale";
    return "live";
  }, [isOnline, isFetching, hasInitialData]);

  const value = useMemo(
    () => ({
      status,
      isOnline,
      isFetching,
    }),
    [status, isOnline, isFetching]
  );

  return (
    <CacheStatusContext.Provider value={value}>
      {children}
    </CacheStatusContext.Provider>
  );
}

export function useCacheStatus(): CacheStatusContextValue {
  const context = useContext(CacheStatusContext);
  if (!context) {
    throw new Error("useCacheStatus must be used within CacheStatusProvider");
  }
  return context;
}
