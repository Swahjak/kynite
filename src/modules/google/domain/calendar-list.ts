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
 * Whether a **newly discovered** calendar starts synced.
 *
 * Before M18 every discovered calendar took the column default (`true`), so
 * linking a work account put every colleague's shared diary, every meeting
 * room and every subscribed holiday feed onto the family board at once — and
 * a parent's first act with the feature was switching most of it off again.
 *
 * The signal is Google's own answer to the same question. `primary` is the
 * account's own calendar, which is always what the person meant. `selected` is
 * the flag Google sets for the calendars that person has actually ticked in
 * their own Calendar UI — that is, the ones they look at. Everything else
 * arrives off: still listed in settings, still one tap from on, just not on the
 * wall until somebody asks for it.
 *
 * This governs *insertion only*. A calendar a parent has already decided about
 * is never re-decided by a discovery pass — see `discoverCalendars`, where this
 * value is in `values` and deliberately absent from the conflict `set`.
 */
export function initialSyncEnabled(resource: GoogleCalendarResource): boolean {
  return resource.primary === true || resource.selected === true;
}
