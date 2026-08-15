/**
 * Caller-assigned Google event ids.
 *
 * M04 review carry-forward: `unique(calendarId, googleEventId)` is NULLS
 * DISTINCT, so any number of local rows may sit at `googleEventId = NULL`. If
 * the push path let Google mint the id, a retry after a timed-out `insert`
 * would create a *second* Google event — the response we never saw already
 * created the first.
 *
 * So we mint the id ourselves, deterministically from the local row id, and
 * claim it on the row before the network call. The insert then becomes
 * idempotent: a retry hits `409 duplicate` for an id that is by construction
 * ours, which the push engine treats as success.
 *
 * Google's id grammar: base32hex (`0-9`, `a-v`), 5–1024 characters. A uuid's
 * hex digits are a subset, and the `kn` prefix keeps ids recognisably ours
 * (both letters are inside `a-v`; `y` and `z`, for instance, are not).
 */

const GOOGLE_ID_PREFIX = 'kn';
const GOOGLE_ID_PATTERN = /^[0-9a-v]{5,1024}$/;

export function googleEventIdFor(localEventId: string): string {
  const hex = localEventId.replace(/-/g, '').toLowerCase();
  const id = `${GOOGLE_ID_PREFIX}${hex}`;

  if (!GOOGLE_ID_PATTERN.test(id)) {
    throw new Error(`cannot derive a Google event id from "${localEventId}"`);
  }
  return id;
}
