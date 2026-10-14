import { ICON_CODEPOINTS, type IconName } from '@kynite/ui';

/**
 * Step shape + icon resolution for the "Sterren vandaag" panel. The row-matching
 * matrix (`starMatrixRows`) was removed once the panel stopped drawing a grid;
 * nothing on this page ever marks a child (`tests/unit/no-negative-marking.test.ts`).
 */

/** One child's step for today, flattened out of their routines. */
export type StarMatrixStep = {
  routineId: string;
  stepId: string;
  title: string;
  icon: IconName;
  /** The logical day this step is being satisfied on — grace days included. */
  occurrenceDate: string;
  done: boolean;
  /** Idempotency key, derived exactly as the hub board derives it (§4). */
  clientId: string;
};

/** A step may carry its own glyph; anything outside the subset font falls back. */
export function resolveStepIcon(icon: string | null, fallback: IconName): IconName {
  return icon && icon in ICON_CODEPOINTS ? (icon as IconName) : fallback;
}
