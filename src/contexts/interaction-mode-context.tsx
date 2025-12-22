"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InteractionMode = "wall" | "manage";

interface InteractionModeContextValue {
  mode: InteractionMode;
}

const InteractionModeContext =
  createContext<InteractionModeContextValue | null>(null);

interface InteractionModeProviderProps {
  mode: InteractionMode;
  children: ReactNode;
}

export function InteractionModeProvider({
  mode,
  children,
}: InteractionModeProviderProps) {
  return (
    <InteractionModeContext.Provider value={{ mode }}>
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
 * when used outside of InteractionModeProvider. Useful for components that
 * need to work in both contexted and non-contexted environments.
 */
export function useInteractionModeSafe(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  return context ?? { mode: "manage" };
}
