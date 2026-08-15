import type { IconName } from '@kynite/ui';

/**
 * Design tokens for the routines slice.
 *
 * Kept out of the components so the Server Actions can validate against the
 * same closed sets the pickers offer — an icon name that arrives in a form is
 * a string the client sent, and it has to land in the type-safe subset the
 * Material Symbols font actually ships (`pnpm icons:subset`).
 */

/** The icons a routine may wear. Every entry is in the subset font. */
export const ROUTINE_ICONS = [
  'task_alt',
  'wb_sunny',
  'dark_mode',
  'schedule',
  'checklist',
  'star',
  'timer',
  'event_available',
] as const satisfies readonly IconName[];

export type RoutineIcon = (typeof ROUTINE_ICONS)[number];

export const DEFAULT_ROUTINE_ICON: RoutineIcon = 'task_alt';

export function isRoutineIcon(value: string): value is RoutineIcon {
  return (ROUTINE_ICONS as readonly string[]).includes(value);
}

export function routineIconOf(value: string | null): RoutineIcon {
  return value && isRoutineIcon(value) ? value : DEFAULT_ROUTINE_ICON;
}

/** Section header icons for the hub board's three time-of-day bands. */
export const SECTION_ICONS = {
  morning: 'wb_sunny',
  afternoon: 'light_mode',
  evening: 'dark_mode',
} as const satisfies Record<string, IconName>;

/**
 * The single-tap step row height from the Stitch hub screen. A step row is the
 * one control a child uses, so it is sized well past the 48px kiosk minimum.
 */
export const STEP_ROW_HEIGHT = 56;
