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

/**
 * Section header icons for the hub board's three time-of-day bands
 * (`docs/design/claude-design/Routines.dc.html`): first light, full sun, night.
 */
export const SECTION_ICONS = {
  morning: 'wb_twilight',
  afternoon: 'wb_sunny',
  evening: 'dark_mode',
} as const satisfies Record<string, IconName>;

/**
 * Each band's hue, from the eight-colour category palette — the icon's ink and
 * the progress rule's fill.
 *
 * Sorting, not status: the colours say "morning / afternoon / evening", never
 * "good / late / bad". Red is absent from this set the way it is absent from
 * every child-facing surface in the product.
 */
export const SECTION_TONE = {
  morning: { icon: 'text-cat-yellow-fg', fill: 'bg-cat-yellow-solid' },
  afternoon: { icon: 'text-cat-teal-fg', fill: 'bg-cat-teal-solid' },
  evening: { icon: 'text-cat-purple-fg', fill: 'bg-cat-purple-solid' },
} as const satisfies Record<string, { icon: string; fill: string }>;

/**
 * The tinted disc a routine's icon sits on, per icon rather than per band.
 *
 * The design sheet colours the medallion after the *thing* — the sun is warm,
 * bedtime is violet, the schoolbag is blue — which is what makes a board of
 * six cards scannable without reading a word. A routine keeps its colour
 * wherever it appears, so the same routine is the same object on the board, in
 * the parent's list and in the builder.
 */
export const ROUTINE_ICON_TILE: Record<RoutineIcon, string> = {
  task_alt: 'bg-cat-blue-surface text-cat-blue-fg',
  wb_sunny: 'bg-cat-yellow-surface text-cat-yellow-fg',
  dark_mode: 'bg-cat-purple-surface text-cat-purple-fg',
  schedule: 'bg-cat-blue-surface text-cat-blue-fg',
  checklist: 'bg-cat-teal-surface text-cat-teal-fg',
  star: 'bg-cat-orange-surface text-cat-orange-fg',
  timer: 'bg-cat-pink-surface text-cat-pink-fg',
  event_available: 'bg-cat-green-surface text-cat-green-fg',
};

/**
 * The single-tap step row height from the Stitch hub screen. A step row is the
 * one control a child uses, so it is sized well past the 48px kiosk minimum.
 */
export const STEP_ROW_HEIGHT = 56;
