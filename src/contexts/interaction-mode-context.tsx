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
