import type { IconName } from '@kynite/ui';
import {
  ACTIVITY_ICONS,
  DEFAULT_ACTIVITY_ICON,
  isActivityIcon,
  suggestIcon,
  type ActivityIcon,
} from '../domain/icon-suggest';

/**
 * Design tokens for the routines slice.
 *
 * Kept out of the components so the Server Actions can validate against the
 * same closed sets the pickers offer — an icon name that arrives in a form is
 * a string the client sent, and it has to land in the type-safe subset the
 * Material Symbols font actually ships (`pnpm icons:subset`).
 */

export { ACTIVITY_ICONS, suggestIcon, type ActivityIcon };

/**
 * `ROUTINE_ICONS` is `ACTIVITY_ICONS` under its original name (M5) — kept as
 * an alias rather than renamed at every call site, since routines, steps and
 * tasks all now share one closed icon set.
 */
export const ROUTINE_ICONS = ACTIVITY_ICONS;

export type RoutineIcon = ActivityIcon;

export const DEFAULT_ROUTINE_ICON: RoutineIcon = DEFAULT_ACTIVITY_ICON;

export function isRoutineIcon(value: string): value is RoutineIcon {
  return isActivityIcon(value);
}

/**
 * The icon a routine or step actually shows: its own `icon` when set and
 * valid, otherwise `suggestIcon(title)` — never a flat default once a title
 * is available. `title` is optional only for call sites that genuinely have
 * none yet; omitting it falls back to `DEFAULT_ROUTINE_ICON`.
 */
export function routineIconOf(value: string | null, title?: string): RoutineIcon {
  if (value && isRoutineIcon(value)) return value;
  return title ? suggestIcon(title) : DEFAULT_ROUTINE_ICON;
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
  dentistry: 'bg-cat-teal-surface text-cat-teal-fg',
  checkroom: 'bg-cat-blue-surface text-cat-blue-fg',
  restaurant: 'bg-cat-orange-surface text-cat-orange-fg',
  backpack: 'bg-cat-blue-surface text-cat-blue-fg',
  wash: 'bg-cat-teal-surface text-cat-teal-fg',
  nutrition: 'bg-cat-orange-surface text-cat-orange-fg',
  menu_book: 'bg-cat-purple-surface text-cat-purple-fg',
  auto_stories: 'bg-cat-purple-surface text-cat-purple-fg',
  wc: 'bg-cat-teal-surface text-cat-teal-fg',
  crib: 'bg-cat-purple-surface text-cat-purple-fg',
  pets: 'bg-cat-pink-surface text-cat-pink-fg',
  lunch_dining: 'bg-cat-orange-surface text-cat-orange-fg',
  directions_car: 'bg-cat-blue-surface text-cat-blue-fg',
  local_laundry_service: 'bg-cat-teal-surface text-cat-teal-fg',
  pedal_bike: 'bg-cat-green-surface text-cat-green-fg',
  shopping_cart: 'bg-cat-green-surface text-cat-green-fg',
  countertops: 'bg-cat-yellow-surface text-cat-yellow-fg',
  toys: 'bg-cat-pink-surface text-cat-pink-fg',
  bedroom_baby: 'bg-cat-purple-surface text-cat-purple-fg',
  delete: 'bg-cat-red-surface text-cat-red-fg',
  potted_plant: 'bg-cat-green-surface text-cat-green-fg',
  mail: 'bg-cat-blue-surface text-cat-blue-fg',
  wb_twilight: 'bg-cat-yellow-surface text-cat-yellow-fg',
  celebration: 'bg-cat-orange-surface text-cat-orange-fg',
  emoji_events: 'bg-cat-yellow-surface text-cat-yellow-fg',
  swipe: 'bg-cat-teal-surface text-cat-teal-fg',
  self_improvement: 'bg-cat-purple-surface text-cat-purple-fg',
};

/**
 * The single-tap step row height from the Stitch hub screen. A step row is the
 * one control a child uses, so it is sized well past the 48px kiosk minimum.
 */
export const STEP_ROW_HEIGHT = 56;
