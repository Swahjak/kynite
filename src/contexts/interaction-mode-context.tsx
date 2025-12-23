"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type InteractionMode = "wall" | "manage";

const STORAGE_KEY = "family-planner:display-mode";

interface InteractionModeContextValue {
  mode: InteractionMode;
  toggleMode: () => void;
  setMode: (mode: InteractionMode) => void;
}

const InteractionModeContext =
  createContext<InteractionModeContextValue | null>(null);

interface InteractionModeProviderProps {
  children: ReactNode;
  /** Initial mode - useful for testing. If not provided, reads from localStorage. */
  initialMode?: InteractionMode;
}

export function InteractionModeProvider({
  children,
  initialMode,
}: InteractionModeProviderProps) {
  const [mode, setModeState] = useState<InteractionMode>(
    initialMode ?? "manage"
  );
  const [isHydrated, setIsHydrated] = useState(!!initialMode);

  // Read from localStorage on mount (skip if initialMode was provided)
  useEffect(() => {
    if (initialMode) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "wall" || stored === "manage") {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, [initialMode]);

  const setMode = useCallback((newMode: InteractionMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "manage" ? "wall" : "manage");
  }, [mode, setMode]);

  // Prevent hydration mismatch by rendering children only after hydration
  if (!isHydrated) {
    return null;
  }

  return (
    <InteractionModeContext.Provider value={{ mode, toggleMode, setMode }}>
      {children}
    </InteractionModeContext.Provider>
  );
}

export function useInteractionMode(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  if (!context) {
    throw new Error(
      "useInteractionMode must be used within InteractionModeProvider"
    );
  }
  return context;
}

/**
 * Safe version of useInteractionMode that returns "manage" mode as default
 * when used outside of InteractionModeProvider.
 */
export function useInteractionModeSafe(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  return context ?? { mode: "manage", toggleMode: () => {}, setMode: () => {} };
}
