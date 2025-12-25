"use client";

import { useContext } from "react";
import { ConfettiContext } from "./confetti-provider";

/**
 * Hook to trigger confetti celebrations.
 *
 * @example
 * const { fire } = useConfetti();
 * fire(3); // Medium intensity (3 stars)
 */
export function useConfetti() {
  const context = useContext(ConfettiContext);

  if (!context) {
    // Graceful degradation for SSR or when used outside provider
    return {
      fire: () => {},
      fireWithOptions: () => {},
    };
  }

  return context;
}
