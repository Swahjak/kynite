import type { EventCategory } from '../schema';

/**
 * Category → design-system classes.
 *
 * Written out in full rather than interpolated, for the same reason
 * `modules/family/ui/tokens.ts` is: Tailwind scans source *text*, so a
 * `bg-cat-${category}-surface` would never be generated into the stylesheet.
 */
export const CATEGORY_CLASSES: Record<
  EventCategory,
  { surface: string; border: string; solid: string; text: string }
> = {
  blue: {
    surface: 'bg-cat-blue-surface',
    border: 'border-cat-blue-border',
    solid: 'bg-cat-blue-solid',
    text: 'text-cat-blue-fg',
  },
  purple: {
    surface: 'bg-cat-purple-surface',
    border: 'border-cat-purple-border',
    solid: 'bg-cat-purple-solid',
    text: 'text-cat-purple-fg',
  },
  orange: {
    surface: 'bg-cat-orange-surface',
    border: 'border-cat-orange-border',
    solid: 'bg-cat-orange-solid',
    text: 'text-cat-orange-fg',
  },
  green: {
    surface: 'bg-cat-green-surface',
    border: 'border-cat-green-border',
    solid: 'bg-cat-green-solid',
    text: 'text-cat-green-fg',
  },
  red: {
    surface: 'bg-cat-red-surface',
    border: 'border-cat-red-border',
    solid: 'bg-cat-red-solid',
    text: 'text-cat-red-fg',
  },
  yellow: {
    surface: 'bg-cat-yellow-surface',
    border: 'border-cat-yellow-border',
    solid: 'bg-cat-yellow-solid',
    text: 'text-cat-yellow-fg',
  },
  pink: {
    surface: 'bg-cat-pink-surface',
    border: 'border-cat-pink-border',
    solid: 'bg-cat-pink-solid',
    text: 'text-cat-pink-fg',
  },
  teal: {
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
    solid: 'bg-cat-teal-solid',
    text: 'text-cat-teal-fg',
  },
};

/** Material Symbols name per event type — the glyph on a chip. */
export const EVENT_TYPE_ICONS = {
  appointment: 'event',
  custody: 'family_restroom',
  reward: 'redeem',
  routine: 'checklist',
  birthday: 'cake',
  other: 'label',
} as const;

/** The hours a time grid renders. Outside this, events stack into an overflow row. */
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 23;

/** Pixels per hour in the day/week time grid — also the drag snap basis. */
export const HOUR_HEIGHT = 56;

/** Drag-and-drop snaps to this many minutes. */
export const SNAP_MINUTES = 15;
