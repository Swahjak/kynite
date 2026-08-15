import {
  EVENT_CATEGORIES,
  hexForCategory,
  nearestCategory,
} from '@/modules/calendar/domain/category';

/**
 * The colour a parent picks for a subscription, both ways.
 *
 * A thin re-expression of the calendar slice's palette, and it earns its place
 * as a *domain* module for a boundary reason rather than a design one: only a
 * `domain/` file may deep-import another slice's `domain/` (architecture §2,
 * enforced by the lint rule), and the alternative — importing
 * `@/modules/calendar`'s barrel from this slice's queries and actions — would
 * drag a React client graph into two server modules.
 *
 * The eight values are the design system's category palette (`--cat-*`), which
 * is what the settings dot and every other colour surface already speak.
 */

export const FEED_COLORS = EVENT_CATEGORIES;

export type FeedColor = (typeof FEED_COLORS)[number];

export const DEFAULT_FEED_COLOR: FeedColor = 'blue';

/** The palette entry as the hex `calendar.color` stores (see `hexForCategory`). */
export function feedColorHex(color: FeedColor): string {
  return hexForCategory(color);
}

/** A stored hex back to its palette entry; anything unreadable reads as blue. */
export function feedColorOf(hex: string | null | undefined): FeedColor {
  return nearestCategory(hex) ?? DEFAULT_FEED_COLOR;
}

export function isFeedColor(value: string): value is FeedColor {
  return (FEED_COLORS as readonly string[]).includes(value);
}
