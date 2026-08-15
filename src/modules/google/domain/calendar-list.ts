import type { GoogleCalendarResource } from './types';

/**
 * Rules about Google's *calendar list*, as opposed to its events (M18).
 *
 * Pure and in `domain/` for the usual reason: the rule below is a product
 * decision about what a family sees on their wall the moment a Google account
 * is linked, and a product decision deserves a test rather than a comment
 * inside a database loop.
 */

/**
 * What a discovery pass does with calendars it has never seen before.
 *
 * - `primary-only` — a **first** link: only the account's own calendar comes
 *   on, and the picker that opens right after linking is where the parent adds
 *   the rest.
 * - `none` — a **relink** (the reauth repair, or simply consenting again with
 *   the same identity). Every re-discovered calendar lands off, because a
 *   calendar missing from our database on a relink is one the parent *removed*
 *   (`removeCalendar` hard-deletes the row), and a repair must not quietly
 *   resurrect it — the primary included. The picker offers it back, ticked off.
 */
export type NewCalendarDefault = 'primary-only' | 'none';

/**
 * Whether a **newly discovered** calendar starts synced.
 *
 * Before M18 every discovered calendar took the column default (`true`), so
 * linking a work account put every colleague's shared diary, every meeting
 * room and every subscribed holiday feed onto the family board at once — and
 * a parent's first act with the feature was switching most of it off again.
 *
 * M18 read Google's `selected` flag alongside `primary` — the calendars a
 * person has ticked in their own Calendar UI — which was still too much: a
 * personal Google account routinely has holiday feeds, a partner's diary and
 * a birthdays calendar all "selected", and all of them arrived on the family
 * wall unasked. So the rule is now the narrowest one that still leaves a
 * working link: **the primary calendar, and nothing else**. Everything the
 * household actually wants is chosen deliberately, in the picker that opens
 * the moment the account is linked (`calendar-picker-dialog.tsx`) or in
 * settings afterwards.
 *
 * This governs *insertion only*. A calendar a parent has already decided about
 * is never re-decided by a discovery pass — see `discoverCalendars`, where this
 * value is in `values` and deliberately absent from the conflict `set`.
 */
export function initialSyncEnabled(
  resource: GoogleCalendarResource,
  mode: NewCalendarDefault = 'primary-only'
): boolean {
  return mode === 'primary-only' && resource.primary === true;
}
