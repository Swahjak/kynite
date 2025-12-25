"use client";

import { createContext, useCallback, type ReactNode } from "react";
import confetti from "canvas-confetti";
import {
  getIntensityFromStars,
  getRandomStyle,
  CONFETTI_PRESETS,
  INTENSITY_MULTIPLIERS,
  type ConfettiIntensity,
  type ConfettiStyle,
} from "./confetti-config";

// =============================================================================
// CONTEXT
// =============================================================================

interface ConfettiContextValue {
  /** Fire confetti with intensity based on star reward */
  fire: (starReward?: number) => void;
  /** Fire confetti with explicit options */
  fireWithOptions: (options: {
    intensity?: ConfettiIntensity;
    style?: ConfettiStyle;
  }) => void;
}

export const ConfettiContext = createContext<ConfettiContextValue | null>(null);

// =============================================================================
// ANIMATION HELPERS
// =============================================================================

function fireFireworks(
  baseOptions: confetti.Options,
  multiplier: number
): void {
  const duration = 2000 * multiplier;
  const animationEnd = Date.now() + duration;

  const interval = setInterval(() => {
    if (Date.now() > animationEnd) {
      clearInterval(interval);
      return;
    }
    confetti({
      ...baseOptions,
      particleCount: Math.round((baseOptions.particleCount ?? 50) * 0.5),
      origin: {
        x: Math.random(),
        y: Math.random() * 0.4,
      },
    });
  }, 200);
}

function fireSideCannons(baseOptions: confetti.Options): void {
  // Left cannon
  confetti({ ...baseOptions, origin: { x: 0, y: 0.6 }, angle: 60 });
  // Right cannon
  confetti({ ...baseOptions, origin: { x: 1, y: 0.6 }, angle: 120 });
}

// =============================================================================
// PROVIDER
// =============================================================================

interface ConfettiProviderProps {
  children: ReactNode;
}

export function ConfettiProvider({ children }: ConfettiProviderProps) {
  const fire = useCallback((starReward: number = 1) => {
    const intensity = getIntensityFromStars(starReward);
    const style = getRandomStyle();
    const preset = CONFETTI_PRESETS[style];
    const multiplier = INTENSITY_MULTIPLIERS[intensity];

    const options: confetti.Options = {
      ...preset,
      particleCount: Math.round((preset.particleCount ?? 100) * multiplier),
    };

    // Handle special multi-burst styles
    if (style === "fireworks") {
      fireFireworks(options, multiplier);
    } else if (style === "sideCannons") {
      fireSideCannons(options);
    } else {
      confetti(options);
    }
  }, []);

  const fireWithOptions = useCallback(
    ({
      intensity = "medium",
      style,
    }: {
      intensity?: ConfettiIntensity;
      style?: ConfettiStyle;
    }) => {
      const selectedStyle = style ?? getRandomStyle();
      const preset = CONFETTI_PRESETS[selectedStyle];
      const multiplier = INTENSITY_MULTIPLIERS[intensity];

      const options: confetti.Options = {
        ...preset,
        particleCount: Math.round((preset.particleCount ?? 100) * multiplier),
      };

      if (selectedStyle === "fireworks") {
        fireFireworks(options, multiplier);
      } else if (selectedStyle === "sideCannons") {
        fireSideCannons(options);
      } else {
        confetti(options);
      }
    },
    []
  );

  return (
    <ConfettiContext.Provider value={{ fire, fireWithOptions }}>
      {children}
    </ConfettiContext.Provider>
  );
}
