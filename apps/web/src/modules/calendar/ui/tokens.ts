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
 * | `ring`    | `--cat-*-solid`      | `oklch(58% 0.14 H)`  | the 2px identity ring around an avatar |
 * | `deep`    | `--cat-*-deep`       | `oklch(42% 0.14 H)`  | the theme banner's brand-mark tile ground |
 * | `strong`  | `--cat-*-strong`     | `oklch(34% 0.13 H)`  | the theme banner's eyebrow pill, white text on it |
 *
 * `deep`/`strong` are the two dark ends of the ramp, and they exist for one
 * surface: the holiday banner (`modules/today/ui/today-theme-banner.tsx`). The
 * tile is the brand mark wearing the day's colours, so it needs a ground the
 * white silhouette reads on — `surface` is far too pale for that, and `solid`
 * is the dot/rule tone, already spoken for.
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
  {
    surface: string;
    /** `--cat-*-fill` (95%) — the *block* ground in a time grid, paler than `surface`. */
    fill: string;
    /** `--cat-*-icon` (45%) — the glyph's own step, between `text` (32%) and `solid` (58%). */
    icon: string;
    border: string;
    rule: string;
    solid: string;
    text: string;
    ring: string;
    deep: string;
    strong: string;
  }
> = {
  blue: {
    surface: 'bg-cat-blue-surface',
    fill: 'bg-cat-blue-fill',
    icon: 'text-cat-blue-icon',
    border: 'border-cat-blue-border',
    rule: 'border-cat-blue-solid',
    solid: 'bg-cat-blue-solid',
    text: 'text-cat-blue-fg',
    ring: 'ring-cat-blue-solid',
    deep: 'bg-cat-blue-deep',
    strong: 'bg-cat-blue-strong',
  },
  purple: {
    surface: 'bg-cat-purple-surface',
    fill: 'bg-cat-purple-fill',
    icon: 'text-cat-purple-icon',
    border: 'border-cat-purple-border',
    rule: 'border-cat-purple-solid',
    solid: 'bg-cat-purple-solid',
    text: 'text-cat-purple-fg',
    ring: 'ring-cat-purple-solid',
    deep: 'bg-cat-purple-deep',
    strong: 'bg-cat-purple-strong',
  },
  orange: {
    surface: 'bg-cat-orange-surface',
    fill: 'bg-cat-orange-fill',
    icon: 'text-cat-orange-icon',
    border: 'border-cat-orange-border',
    rule: 'border-cat-orange-solid',
    solid: 'bg-cat-orange-solid',
    text: 'text-cat-orange-fg',
    ring: 'ring-cat-orange-solid',
    deep: 'bg-cat-orange-deep',
    strong: 'bg-cat-orange-strong',
  },
  green: {
    surface: 'bg-cat-green-surface',
    fill: 'bg-cat-green-fill',
    icon: 'text-cat-green-icon',
    border: 'border-cat-green-border',
    rule: 'border-cat-green-solid',
    solid: 'bg-cat-green-solid',
    text: 'text-cat-green-fg',
    ring: 'ring-cat-green-solid',
    deep: 'bg-cat-green-deep',
    strong: 'bg-cat-green-strong',
  },
  red: {
    surface: 'bg-cat-red-surface',
    fill: 'bg-cat-red-fill',
    icon: 'text-cat-red-icon',
    border: 'border-cat-red-border',
    rule: 'border-cat-red-solid',
    solid: 'bg-cat-red-solid',
    text: 'text-cat-red-fg',
    ring: 'ring-cat-red-solid',
    deep: 'bg-cat-red-deep',
    strong: 'bg-cat-red-strong',
  },
  yellow: {
    surface: 'bg-cat-yellow-surface',
    fill: 'bg-cat-yellow-fill',
    icon: 'text-cat-yellow-icon',
    border: 'border-cat-yellow-border',
    rule: 'border-cat-yellow-solid',
    solid: 'bg-cat-yellow-solid',
    text: 'text-cat-yellow-fg',
    ring: 'ring-cat-yellow-solid',
    deep: 'bg-cat-yellow-deep',
    strong: 'bg-cat-yellow-strong',
  },
  pink: {
    surface: 'bg-cat-pink-surface',
    fill: 'bg-cat-pink-fill',
    icon: 'text-cat-pink-icon',
    border: 'border-cat-pink-border',
    rule: 'border-cat-pink-solid',
    solid: 'bg-cat-pink-solid',
    text: 'text-cat-pink-fg',
    ring: 'ring-cat-pink-solid',
    deep: 'bg-cat-pink-deep',
    strong: 'bg-cat-pink-strong',
  },
  teal: {
    surface: 'bg-cat-teal-surface',
    fill: 'bg-cat-teal-fill',
    icon: 'text-cat-teal-icon',
    border: 'border-cat-teal-border',
    rule: 'border-cat-teal-solid',
    solid: 'bg-cat-teal-solid',
    text: 'text-cat-teal-fg',
    ring: 'ring-cat-teal-solid',
    deep: 'bg-cat-teal-deep',
    strong: 'bg-cat-teal-strong',
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

/**
 * Pixels per hour in the day/week time grid — also the drag snap basis.
 *
 * 58, not 56: `docs/design/claude-design/Kalender.dc.html` draws every hour row
 * at 58px, and an hour that is two pixels short compounds into a 34px drift
 * over the seventeen rendered hours — enough for the now line to sit visibly
 * off its own hour rule near the bottom of the grid.
 */
export const HOUR_HEIGHT = 58;

/** Drag-and-drop snaps to this many minutes. */
export const SNAP_MINUTES = 15;
