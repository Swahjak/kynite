/**
 * Celebration animations (docs/architecture.md §2 `components/celebration/`).
 *
 * Wave B moved the two halves that are pure design system into `@kynite/ui`:
 * the non-strobing presets (they are motion *tokens* — durations, particle
 * counts, the no-red palette — and the design system's "Motion & celebration"
 * section is where they are specified) and `StarPop`, which is a presentational
 * component with a label prop. What stays here is `fireConfettiBurst`, the one
 * piece that is not presentational at all: it dynamically `import()`s
 * `canvas-confetti`, an app dependency the package does not carry, and it draws
 * onto a viewport-wide canvas rather than into a React tree.
 *
 * The barrel keeps re-exporting all of it, so `@/components/celebration` is
 * still the one import for a surface that celebrates.
 */

export {
  CELEBRATION_COLORS,
  CELEBRATION_INTENSITIES,
  CELEBRATION_LIMITS,
  CELEBRATION_PRESETS,
  prefersReducedMotion,
  StarPop,
  type CelebrationIntensity,
  type CelebrationPreset,
  type StarPopProps,
} from '@kynite/ui';

export { fireConfettiBurst, type ConfettiBurstOptions } from './confetti-burst';
