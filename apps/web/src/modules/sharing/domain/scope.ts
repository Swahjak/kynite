/**
 * What a share link opens, as pure data (docs/architecture.md §7 "Caregiver
 * share links").
 *
 * Framework-free per §2 rule 2: no drizzle, no React, no database. The stored
 * column's type lives here rather than in `../schema.ts` so that the `(share)`
 * route tree — which may not transitively import a `'use server'` module, and
 * therefore reads its scope through pure code — can reason about a scope
 * without pulling drizzle in behind it.
 */

/**
 * Which read surfaces a link opens. Absent = every surface its role allows.
 *
 * Four values, unchanged from the M04 schema baseline. M13 ships renderers for
 * `calendar` and `routines` — the two the §7 matrix actually grants a share
 * principal a read on — and `SHARE_SURFACE_CHOICES` below is what the settings
 * UI offers, so a parent is never shown a toggle with nothing behind it. The
 * other two stay in the vocabulary because narrowing a stored jsonb enum to
 * re-widen it later is the change that needs a migration story, and adding a
 * renderer is not.
 */
export const SHARE_SURFACES = ['calendar', 'routines', 'rewards', 'timers'] as const;

/** The surfaces M13 renders — the set `(app)/settings/sharing` lets parents pick. */
export const SHARE_SURFACE_CHOICES = ['calendar', 'routines'] as const;

export type ShareSurface = (typeof SHARE_SURFACES)[number];

/**
 * The stored scope. Mirrors `ShareScope` in `modules/family/authorize.ts`:
 * an absent dimension is unrestricted, and `decide()` fails closed when a
 * restricted dimension has nothing to test against.
 */
export type ShareLinkScope = {
  memberIds?: string[];
  calendarIds?: string[];
  surfaces?: ShareSurface[];
};

export function isShareSurface(value: unknown): value is ShareSurface {
  return SHARE_SURFACES.includes(value as ShareSurface);
}

/**
 * Normalise a scope into its canonical stored shape.
 *
 * An **empty array is not an empty restriction** — it is dropped to
 * `undefined`. That collapse is deliberate and it is the only place the
 * distinction is decided: `authorize.decide()` reads `undefined` as
 * "unrestricted" and an array as "exactly these", so a stored `[]` would mean
 * "scoped to nobody", i.e. a link that renders an empty page forever. A parent
 * who ticks no members means "everyone", which is what the UI says; a link
 * that silently shows nothing would look broken rather than restricted.
 */
export function normalizeScope(input: ShareLinkScope | null | undefined): ShareLinkScope {
  if (!input) return {};

  const scope: ShareLinkScope = {};

  const memberIds = dedupe(input.memberIds);
  if (memberIds.length > 0) scope.memberIds = memberIds;

  const calendarIds = dedupe(input.calendarIds);
  if (calendarIds.length > 0) scope.calendarIds = calendarIds;

  const surfaces = dedupe(input.surfaces).filter(isShareSurface);
  // Every surface selected is the same statement as none selected, and the
  // shorter one survives a change to `SHARE_SURFACES` without going stale.
  if (surfaces.length > 0 && surfaces.length < SHARE_SURFACES.length) scope.surfaces = surfaces;

  return scope;
}

function dedupe<T>(values: readonly T[] | undefined): T[] {
  return values ? [...new Set(values)] : [];
}

/** Whether this link opens a given surface. Absent `surfaces` = all of them. */
export function opensSurface(scope: ShareLinkScope, surface: ShareSurface): boolean {
  return scope.surfaces === undefined || scope.surfaces.includes(surface);
}

/**
 * Whether a member is inside the link's scope.
 *
 * Absent `memberIds` is unrestricted, matching `decide()`. This is the *read*
 * side of the same rule the authorization chokepoint enforces on writes — the
 * two must agree, or a caregiver would see a child they cannot tick, or worse,
 * tick a child they cannot see.
 */
export function coversMember(scope: ShareLinkScope, memberId: string): boolean {
  return scope.memberIds === undefined || scope.memberIds.includes(memberId);
}

/** Whether a calendar is inside the link's scope. Native events carry none. */
export function coversCalendar(scope: ShareLinkScope, calendarId: string | null): boolean {
  if (scope.calendarIds === undefined) return true;
  // A native (non-Google) event has no calendar to test the restriction
  // against. A calendar-restricted link is a statement about *which Google
  // calendars* to expose, not a licence to show everything that has none, so
  // this fails closed — the same reading `decide()` gives an untestable
  // dimension.
  return calendarId !== null && scope.calendarIds.includes(calendarId);
}

/** The lifecycle a parent sees in settings, and the gate the resolver applies. */
export type ShareLinkState = 'active' | 'expired' | 'revoked';

/**
 * Revocation outranks expiry: a link a parent took away reads "revoked" even
 * after its expiry passes, because that is the fact the parent acted on.
 */
export function shareLinkStateOf(
  link: { expiresAt: Date | null; revokedAt: Date | null },
  now: Date
): ShareLinkState {
  if (link.revokedAt !== null) return 'revoked';
  if (link.expiresAt !== null && link.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'active';
}

/**
 * Whether this resolution should re-stamp `lastUsedAt` / bump `useCount`.
 *
 * See `SHARE_USE_COALESCE_MS` in `@/lib/share-token`: the counter is a count of
 * *visits*, not of HTTP requests, and the coalescing window is what makes it
 * one and keeps a wall of UPDATEs off a public endpoint.
 */
export function shouldCountShareUse(lastUsedAt: Date | null, now: Date, windowMs: number): boolean {
  if (!lastUsedAt) return true;
  return now.getTime() - lastUsedAt.getTime() >= windowMs;
}
