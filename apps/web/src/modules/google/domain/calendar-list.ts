import type { GoogleCalendarResource } from './types';

/**
 * Rules about Google's *calendar list*, as opposed to its events (M18).
 *
 * Pure and in `domain/` for the usual reason: the rule below is a product
 * decision about what a family sees on their wall the moment a Google account
 * is linked, and a product decision deserves a test rather than a comment
 * inside a database loop.
 */

/** Google's resource calendars — meeting rooms, equipment — carry this domain. */
const RESOURCE_CALENDAR_SUFFIX = '@resource.calendar.google.com';

/**
 * Whether a calendar list entry may exist in Kynite **at all**.
 *
 * This used to be owner-only (`accessRole: 'owner'`): the calendars a person
 * created themselves, with everything shared or subscribed refused outright as
 * "somebody else's diary". That boundary turned out to solve a problem the
 * sync default already solves — `initialSyncEnabled` is primary-only, so
 * nothing but the primary ever turns on by itself — while creating a real one:
 * a calendar that is *personally* somebody's without being theirs at Google.
 * An employer's shift roster ("ESS Shifts") arrives `reader`, exactly like a
 * holiday feed, and no signal Google sends can tell the two apart. That
 * judgment is human, so the picker is where it lives: store everything with
 * readable events, all of it off by default, and let a parent tick what
 * belongs on the wall.
 *
 * What still never gets stored:
 * - `freeBusyReader` (or no role at all) — busy blocks only, no events to sync.
 * - meeting rooms and equipment (`@resource.calendar.google.com`) — resources,
 *   not diaries, whatever their access role says.
 * - anything Google marks `deleted` — it no longer exists.
 *
 * `discoverCalendars` prunes a stored row that stops qualifying — which now
 * means "gone from Google's list" (unsubscribed, access revoked, deleted)
 * rather than "not owned".
 */
export function isStorableCalendar(resource: GoogleCalendarResource): boolean {
  return (
    resource.deleted !== true &&
    (resource.accessRole === 'owner' ||
      resource.accessRole === 'writer' ||
      resource.accessRole === 'reader') &&
    !resource.id.endsWith(RESOURCE_CALENDAR_SUFFIX)
  );
}

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
 * This is a *default*, and since the storage rule widened it is the only
 * boundary that keeps a fresh link quiet: `discoverCalendars` now stores
 * shared and subscribed calendars too (`isStorableCalendar`), so everything
 * except the primary — the holiday feed included — arrives OFF and waits for
 * the picker.
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
