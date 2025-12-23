"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InteractionMode = "wall" | "management";

interface InteractionModeContextValue {
  mode: InteractionMode;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canDragDrop: boolean;
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
  const isManagement = mode === "management";

  const value: InteractionModeContextValue = {
    mode,
    canEdit: isManagement,
    canCreate: isManagement,
    canDelete: isManagement,
    canDragDrop: isManagement,
  };

  return (
    <InteractionModeContext.Provider value={value}>
      {children}
    </InteractionModeContext.Provider>
  );
}

export function useInteractionMode() {
  const context = useContext(InteractionModeContext);
  if (!context) {
    throw new Error(
      "useInteractionMode must be used within an InteractionModeProvider"
    );
  }
  return context;
}

/**
 * Safe version that returns "management" mode permissions as default
 * when used outside of InteractionModeProvider.
 */
export function useInteractionModeSafe(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  return (
    context ?? {
      mode: "management",
      canEdit: true,
      canCreate: true,
      canDelete: true,
      canDragDrop: true,
    }
  );
}
