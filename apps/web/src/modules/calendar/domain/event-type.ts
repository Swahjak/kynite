/**
 * The event taxonomy, and the two cues it carries (M23).
 *
 * This file is the single source for both. An event's hue and an event's glyph
 * are functions of its **type** and of nothing else, everywhere in the app:
 * chips, list rows, dots, month pips, the up-next grid, the hub board. That is
 * the whole colouring policy in one sentence, and it replaces three competing
 * sources that used to answer the same question differently on different
 * screens — a per-event colour override, a per-calendar colour a parent could
 * set, and Google's own hex for the calendar.
 *
 * The two dimensions it deliberately does **not** touch:
 *
 * - **Member colour is identity.** It draws avatars, rings and person-column
 *   headers, and it never fills an event surface. A family reads "green" as
 *   Mila, not as sport, and the two meanings cannot share a surface.
 * - **Calendar colour is provenance.** Demoted to a dot beside the calendar's
 *   name in settings, where the question actually is "which Google calendar is
 *   this" — and to nowhere else.
 *
 * It lives in `domain/` rather than in `ui/tokens.ts` because the server reads
 * it too: `queries.ts` resolves the hue as it maps a row, so no view has to.
 * `ui/tokens.ts` turns the hue into Tailwind classes, which is the part that
 * genuinely belongs to the UI.
 */

import type { EventCategory, EventType } from '../schema';

/** The hue each type renders in — one of the eight design-system categories. */
export const EVENT_TYPE_CATEGORY: Record<EventType, EventCategory> = {
  // School and opvang share blue on purpose: for a child they are the same
  // kind of day, and a parent reads the pair as "somewhere they are dropped
  // off". The icons tell them apart.
  school: 'blue',
  childcare: 'blue',
  sport: 'green',
  // Muziek & les and spelen & vrienden share yellow for the same reason: both
  // are the afternoon, both are optional, and eight hues do not stretch to
  // eleven types without two deliberate pairs.
  music: 'yellow',
  play: 'yellow',
  health: 'red',
  family: 'pink',
  birthday: 'pink',
  holiday: 'orange',
  work: 'teal',
  other: 'purple',
};

/**
 * Material Symbols name per type — the glyph on a chip, a row, a picker.
 *
 * Every name here must also be reachable by `scripts/subset-icons.mjs`, which
 * cannot see an indirection: they are listed in that script's `EXTRA_ICONS`,
 * and `pnpm icons:check` fails the build if one of them is missing from the
 * subsetted font rather than shipping a blank box.
 */
export const EVENT_TYPE_ICONS: Record<EventType, string> = {
  school: 'school',
  childcare: 'child_care',
  sport: 'sports_soccer',
  music: 'music_note',
  play: 'toys',
  health: 'medical_services',
  family: 'celebration',
  birthday: 'cake',
  holiday: 'beach_access',
  work: 'work',
  other: 'event',
};

/** The hue an event renders in. Total by construction — no view handles a null. */
export function categoryForType(type: EventType): EventCategory {
  return EVENT_TYPE_CATEGORY[type];
}
