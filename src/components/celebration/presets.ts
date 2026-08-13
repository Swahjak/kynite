/**
 * Celebration presets — shared, non-strobing, intensity-configurable.
 *
 * Two constraints shape every number in this file, and neither is decoration.
 *
 * **Non-strobing.** A wall display in a kitchen is at eye level for a child who
 * may be photosensitive. WCAG 2.3.1 puts the general/red flash threshold at
 * three flashes per second; the presets here fire a *single* burst with a slow
 * gravity fall and no repeat, so the flash rate is zero by construction rather
 * than by tuning. `ticks` is what bounds the animation's life — a particle that
 * never dies is a particle that keeps flickering at the bottom of the screen.
 *
 * **Intensity-configurable.** A morning routine step is not a savings goal
 * being reached. `gentle` is the everyday tap; `standard` is a whole routine
 * finished; `big` is reserved for the rare moment (M08's redemption approval).
 * A household that finds any of it too much turns the whole thing down to
 * `gentle` — the setting is a dial, never an on/off that leaves a child with
 * nothing.
 *
 * The palette is the brand's, deliberately excluding red: red particles read as
 * an alert, and nothing in this product marks anything (research §Decisions 1).
 */

export const CELEBRATION_INTENSITIES = ['gentle', 'standard', 'big'] as const;

export type CelebrationIntensity = (typeof CELEBRATION_INTENSITIES)[number];

/**
 * The confetti palette, quoted from `docs/design/motion.md`: the regular burst
 * mixes `#ef8d5d`, `#71f8e4`, `#b8c3ff` and `#006056`, and the big-celebration
 * burst adds `#fecf6e`. No red, no white flash.
 */
export const CELEBRATION_COLORS = ['#ef8d5d', '#71f8e4', '#b8c3ff', '#006056', '#fecf6e'] as const;

export type CelebrationPreset = {
  particleCount: number;
  spread: number;
  startVelocity: number;
  /** Frames a particle lives for. Bounded, so nothing lingers or flickers. */
  ticks: number;
  gravity: number;
  scalar: number;
  decay: number;
  colors: string[];
  /** Approximate wall-clock life of the burst, in ms. */
  durationMs: number;
};

export const CELEBRATION_PRESETS: Record<CelebrationIntensity, CelebrationPreset> = {
  gentle: {
    particleCount: 24,
    spread: 55,
    startVelocity: 22,
    ticks: 90,
    gravity: 0.9,
    scalar: 0.8,
    decay: 0.92,
    colors: [...CELEBRATION_COLORS],
    durationMs: 900,
  },
  standard: {
    particleCount: 56,
    spread: 70,
    startVelocity: 28,
    ticks: 120,
    gravity: 0.9,
    scalar: 0.95,
    decay: 0.92,
    colors: [...CELEBRATION_COLORS],
    durationMs: 1200,
  },
  big: {
    particleCount: 96,
    spread: 90,
    startVelocity: 34,
    ticks: 150,
    gravity: 0.85,
    scalar: 1.1,
    decay: 0.93,
    colors: [...CELEBRATION_COLORS],
    durationMs: 1600,
  },
};

/**
 * Hard ceiling every preset is checked against.
 *
 * `ticks` at 60fps must stay under ~3s so a burst cannot overlap the next tap,
 * and `particleCount` stays low enough that a Raspberry-Pi-class kiosk renders
 * the burst without dropping the frame the tap itself needs.
 */
export const CELEBRATION_LIMITS = {
  maxTicks: 180,
  maxParticleCount: 120,
  maxDurationMs: 2000,
} as const;

/**
 * Does the current environment want motion at all?
 *
 * Defaults to *allowing* motion when the query cannot be evaluated (SSR, an
 * old browser): the celebration is the feedback, and silently removing it for
 * everyone would be the worse failure. Every animation module gates on this.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
