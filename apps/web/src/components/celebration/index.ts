/**
 * Celebration animations (docs/architecture.md §2 `components/celebration/`).
 * One module per animation; shared, non-strobing presets in `presets.ts`.
 */

export {
  CELEBRATION_COLORS,
  CELEBRATION_INTENSITIES,
  CELEBRATION_LIMITS,
  CELEBRATION_PRESETS,
  prefersReducedMotion,
  type CelebrationIntensity,
  type CelebrationPreset,
} from './presets';

export { fireConfettiBurst, type ConfettiBurstOptions } from './confetti-burst';
export { StarPop, type StarPopProps } from './star-pop';
