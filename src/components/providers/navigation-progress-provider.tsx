"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { NavigationProgress } from "@/components/ui/navigation-progress";

interface NavigationProgressContextValue {
  startProgress: () => void;
  completeProgress: () => void;
}

const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);
  if (!context) {
    throw new Error(
      "useNavigationProgress must be used within NavigationProgressProvider"
    );
  }
  return context;
}

interface NavigationProgressProviderProps {
  children: ReactNode;
}

export function NavigationProgressProvider({
  children,
}: NavigationProgressProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    clearTimers();
    startTimeRef.current = Date.now();
    setIsLoading(true);
    setProgress(0);

    // Animate progress gradually
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 10;
      if (currentProgress > 80) {
        currentProgress = 80 + Math.random() * 5;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
      setProgress(Math.min(currentProgress, 90));
    }, 200);
  }, [clearTimers]);

  const completeProgress = useCallback(() => {
    clearTimers();

    // Check if navigation was fast (< 100ms) - don't show bar for fast navigations
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 100) {
      setIsLoading(false);
      setProgress(0);
      return;
    }

    setProgress(100);
    completeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 200);
  }, [clearTimers]);

  // Track route changes
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <NavigationProgressContext.Provider
      value={{ startProgress, completeProgress }}
    >
      <AnimatePresence>
        {isLoading && (
          <NavigationProgress isLoading={isLoading} progress={progress} />
        )}
      </AnimatePresence>
      {children}
    </NavigationProgressContext.Provider>
  );
}
