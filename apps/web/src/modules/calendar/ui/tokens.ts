import type { IconName } from '@kynite/ui';
import { EVENT_TYPE_ICONS as TYPE_ICONS } from '../domain/event-type';
import type { EventCategory, EventType } from '../schema';

/**
 * Category → design-system classes.
 *
 * Written out in full rather than interpolated, for the same reason
 * `modules/family/ui/tokens.ts` is: Tailwind scans source *text*, so a
 * `bg-cat-${category}-surface` would never be generated into the stylesheet.
 *
 * Four *different* tones per hue, and the difference matters
 * (`docs/design/colors.md` § "Category palette"):
 *
 * | key       | token                | value                | used for |
 * | --------- | -------------------- | -------------------- | -------- |
 * | `surface` | `--cat-*-surface`    | `oklch(94% 0.025 H)` | chip / event-card fill |
 * | `border`  | `--cat-*-border`     | `oklch(85% 0.05 H)`  | the **pale chip outline** (`Chip/Category`) |
 * | `rule`    | `--cat-*-solid`      | `oklch(58% 0.14 H)`  | the **4px left rule** on an event card, as a border colour |
 * | `solid`   | `--cat-*-solid`      | `oklch(58% 0.14 H)`  | the same hue as a *fill* — dots, pips, swatches |
 * | `text`    | `--cat-*-fg`         | `oklch(32% 0.08 H)`  | chip text |
 *
 * `rule` exists because `border` and the 4px rule are **not** the same tone:
 * `calendar.md` § "Event list item" draws the bar at `oklch(58% 0.14 H)` (the
 * solid), while `colors.md` gives the chip outline the much paler
 * `oklch(85% 0.05 H)`. Both are border *colours*, so one key cannot serve both
 * — using `border` for the rule (as this table did before the design system
 * landed) drew the category cue at a tenth of its intended contrast.
 */
export const CATEGORY_CLASSES: Record<
  EventCategory,
  { surface: string; border: string; rule: string; solid: string; text: string }
> = {
  blue: {
    surface: 'bg-cat-blue-surface',
    border: 'border-cat-blue-border',
    rule: 'border-cat-blue-solid',
    solid: 'bg-cat-blue-solid',
    text: 'text-cat-blue-fg',
  },
  purple: {
    surface: 'bg-cat-purple-surface',
    border: 'border-cat-purple-border',
    rule: 'border-cat-purple-solid',
    solid: 'bg-cat-purple-solid',
    text: 'text-cat-purple-fg',
  },
  orange: {
    surface: 'bg-cat-orange-surface',
    border: 'border-cat-orange-border',
    rule: 'border-cat-orange-solid',
    solid: 'bg-cat-orange-solid',
    text: 'text-cat-orange-fg',
  },
  green: {
    surface: 'bg-cat-green-surface',
    border: 'border-cat-green-border',
    rule: 'border-cat-green-solid',
    solid: 'bg-cat-green-solid',
    text: 'text-cat-green-fg',
  },
  red: {
    surface: 'bg-cat-red-surface',
    border: 'border-cat-red-border',
    rule: 'border-cat-red-solid',
    solid: 'bg-cat-red-solid',
    text: 'text-cat-red-fg',
  },
  yellow: {
    surface: 'bg-cat-yellow-surface',
    border: 'border-cat-yellow-border',
    rule: 'border-cat-yellow-solid',
    solid: 'bg-cat-yellow-solid',
    text: 'text-cat-yellow-fg',
  },
  pink: {
    surface: 'bg-cat-pink-surface',
    border: 'border-cat-pink-border',
    rule: 'border-cat-pink-solid',
    solid: 'bg-cat-pink-solid',
    text: 'text-cat-pink-fg',
  },
  teal: {
    surface: 'bg-cat-teal-surface',
    border: 'border-cat-teal-border',
    rule: 'border-cat-teal-solid',
    solid: 'bg-cat-teal-solid',
    text: 'text-cat-teal-fg',
  },
};

/**
 * Material Symbols name per event type — the glyph on a chip, a row, a picker.
 *
 * The table itself lives in `domain/event-type.ts`, beside the hue it travels
 * with; this is the UI-typed view of it. The assertion is what `pnpm
 * icons:check` exists to keep honest: a name that never made it into the
 * subsetted font would render as a blank box, so the check fails the build
 * instead.
 */
export const EVENT_TYPE_ICONS = TYPE_ICONS as Record<EventType, IconName>;

/** The hours a time grid renders. Outside this, events stack into an overflow row. */
export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 23;

/** Pixels per hour in the day/week time grid — also the drag snap basis. */
export const HOUR_HEIGHT = 56;

/** Drag-and-drop snaps to this many minutes. */
export const SNAP_MINUTES = 15;
