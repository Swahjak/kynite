import type { Options as ConfettiOptions } from "canvas-confetti";

// =============================================================================
// INTENSITY LEVELS
// =============================================================================

export type ConfettiIntensity = "small" | "medium" | "large";

export function getIntensityFromStars(stars: number): ConfettiIntensity {
  if (stars >= 5) return "large";
  if (stars >= 3) return "medium";
  return "small";
}

export const INTENSITY_MULTIPLIERS: Record<ConfettiIntensity, number> = {
  small: 0.5,
  medium: 1.0,
  large: 2.0,
};

// =============================================================================
// ANIMATION STYLES
// =============================================================================

export type ConfettiStyle =
  | "cannon"
  | "fireworks"
  | "stars"
  | "sideCannons"
  | "burst";

export const CONFETTI_STYLES: ConfettiStyle[] = [
  "cannon",
  "fireworks",
  "stars",
  "sideCannons",
  "burst",
];

export function getRandomStyle(): ConfettiStyle {
  return CONFETTI_STYLES[Math.floor(Math.random() * CONFETTI_STYLES.length)];
}

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

export const CONFETTI_PRESETS: Record<ConfettiStyle, ConfettiOptions> = {
  cannon: {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  },
  fireworks: {
    particleCount: 50,
    spread: 360,
    ticks: 60,
    gravity: 0,
    origin: { x: 0.5, y: 0.5 },
  },
  stars: {
    particleCount: 50,
    shapes: ["star"],
    colors: ["#FFD700", "#FFA500", "#FF6347", "#FFE135"],
    spread: 90,
    origin: { y: 0.6 },
  },
  sideCannons: {
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
  },
  burst: {
    particleCount: 150,
    spread: 180,
    startVelocity: 30,
    ticks: 100,
    origin: { y: 0.6 },
  },
};
