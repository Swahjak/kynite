/**
 * The confetti burst — one module, one animation (M07: "one module per
 * animation under `components/celebration/`").
 *
 * `canvas-confetti` is loaded *dynamically*, on the first celebration rather
 * than in the page bundle. The hub boots to a board a family glances at; the
 * confetti engine is ~7 KB that nothing needs until a child taps something, and
 * the tap itself has a <100ms budget that a smaller first load protects.
 *
 * Fire-and-forget by design: this never throws and never returns a promise the
 * caller has to await. A completion that cannot draw confetti is still a
 * completion — the praise text is the headline, and it is plain DOM.
 */

import { CELEBRATION_PRESETS, prefersReducedMotion, type CelebrationIntensity } from './presets';

export type ConfettiBurstOptions = {
  intensity?: CelebrationIntensity;
  /**
   * Where the burst starts, in viewport fractions (`{x: 0..1, y: 0..1}`).
   * Defaults to slightly below centre, which is where a tapped step row sits
   * on both the hub tablet and a phone.
   */
  origin?: { x: number; y: number };
};

export function fireConfettiBurst(options: ConfettiBurstOptions = {}): void {
  // Respected, not approximated: a reduced-motion setting means no particles
  // at all, and the completed state still reads as done because the row's own
  // treatment (checkmark, praise line, star) never depended on the animation.
  if (prefersReducedMotion()) return;

  const preset = CELEBRATION_PRESETS[options.intensity ?? 'gentle'];

  const payload = {
    particleCount: preset.particleCount,
    spread: preset.spread,
    startVelocity: preset.startVelocity,
    ticks: preset.ticks,
    gravity: preset.gravity,
    scalar: preset.scalar,
    decay: preset.decay,
    colors: preset.colors,
    origin: options.origin ?? { x: 0.5, y: 0.6 },
    disableForReducedMotion: true,
  };

  if (typeof window === 'undefined') return;

  void import('canvas-confetti')
    .then(({ default: confetti }) => {
      confetti(payload);
    })
    .catch(() => {
      // A celebration that fails to load is not an error a family should ever
      // see. The completion has already landed.
    });
}
