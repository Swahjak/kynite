/**
 * The single authorization chokepoint (docs/architecture.md §7).
 *
 * Pure and framework-free on purpose: no session reads, no database, no
 * `server-only`. Everything that mutates state calls `can()` — or `assertCan()`
 * in `./principal`, which resolves the request principal and delegates here —
 * before it touches data. A single audited table beats scattered checks.
 */

import type { MemberRole } from './schema';

/** Every capability in the §7 permission matrix, in matrix order. */
export const CAPABILITIES = [
  'calendar:view',
  'calendar:view_private',
  'event:write',
  'family:manage',
  'display:manage',
  'google:link',
  'member:manage',
  'member:self',
  'routine:write',
  'completion:write',
  'task:write',
  'task:complete',
  'stars:award',
  'stars:remove',
  'redemption:request',
  'redemption:approve',
  'reward:manage',
  'device:manage',
  'share:manage',
  'timer:control',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Share-link roles (PRD FR25: Owner / Contributor / Viewer). */
export type ShareRole = 'contributor' | 'viewer';

export type ShareScope = {
  /** `undefined` = unrestricted on that dimension. */
  memberIds?: readonly string[];
  calendarIds?: readonly string[];
};

/**
 * Who is asking. Mirrors the matrix columns: an account-backed `member`
 * (whose `role` picks the Owner / Adult / Child column), a paired kiosk
 * `device`, or a `share` link principal with no session at all.
 */
export type Principal =
  | { kind: 'member'; familyId: string; memberId: string; role: MemberRole }
  | { kind: 'device'; familyId: string; deviceId: string }
  | { kind: 'share'; familyId: string; role: ShareRole; scope: ShareScope };

/** What is being acted on. Omit only for capabilities with no resource. */
export type Resource = {
  familyId: string;
  /** Owning member — resolves the "own" grade (own calendar, own Google account). */
  ownerMemberId?: string | null;
  /** Subject member — resolves the "scoped" grade for share links. */
  memberId?: string | null;
  calendarId?: string | null;
};

/**
 * A matrix cell. `own` and `scoped` are conditional grants resolved against the
 * resource; `busy-only` is a *partial* read (free/busy, no detail) which `can()`
 * reports as `false` — callers that can render busy-only ask `decide()`.
 */
export type Grade = 'allow' | 'deny' | 'own' | 'scoped' | 'busy-only';

type Column = 'owner' | 'adult' | 'child' | 'contributor' | 'viewer' | 'device';

/**
 * docs/architecture.md §7 permission matrix, transcribed verbatim.
 * "stars:remove" is `deny` in every column by design — the invariant is made
 * visible here and enforced by `CHECK (amount > 0)` in the star ledger (M04).
 */
const MATRIX: Record<Capability, Record<Column, Grade>> = {
  'calendar:view': {
    owner: 'allow',
    adult: 'allow',
    child: 'allow',
    contributor: 'scoped',
    viewer: 'scoped',
    device: 'allow',
  },
  'calendar:view_private': {
    owner: 'allow',
    adult: 'own',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'busy-only',
  },
  'event:write': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  /**
   * The household itself — its name, locale, timezone, week start, and its
   * deletion (M16).
   *
   * Not a row in §7's printed matrix; the second deliberate addition after
   * M14's `member:self`, and it needs carrying into the doc. §7 grades
   * "Manage members & roles" owner-only because who is in the household and
   * what they may do is structural, and the *identity* of the household — the
   * name on it, the language it speaks, the clock every surface renders in,
   * and whether it continues to exist at all — is the same kind of fact. An
   * adult second parent gets everything operational (events, routines, stars,
   * devices, share links) and nothing that redefines the household under the
   * other parent, which is exactly the line `member:manage` already draws.
   *
   * Family deletion in particular has no separate cell: it is the extreme end
   * of the same authority, and inventing `family:delete` would suggest the two
   * could sensibly be granted apart. They cannot — anyone who may rename the
   * household and move it to another timezone is the person who may end it.
   */
  'family:manage': {
    owner: 'allow',
    adult: 'deny',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  /**
   * How the *shared surfaces* look: the hub's default board, and the colour
   * and family/private visibility of each calendar (PRD FR28, M16).
   *
   * Graded `allow` for the adult column while `family:manage` is `deny`, and
   * the split is FR28's own wording: "**Parents** can configure Hub display
   * preferences via the Controller" — both of them, not only whoever signed
   * up first. It is also the safe half: a second parent recolouring a calendar
   * or switching the wall display to the agenda changes what the household
   * *sees*, and nothing about what it is or who is in it. Nothing here can
   * reveal data either — `calendar:view_private` still decides who reads a
   * private calendar's detail; marking a calendar private only ever shows
   * *less*.
   *
   * The kiosk is `deny` like every other write: §7 is explicit that a device
   * session may write "completions, timers and redemption requests — never
   * settings", and a wall tablet reconfiguring the wall is precisely the
   * settings write that rule names.
   */
  'display:manage': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'google:link': {
    owner: 'allow',
    adult: 'own',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'member:manage': {
    owner: 'allow',
    adult: 'deny',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  /**
   * Edit *your own* presentation — avatar and colour, nothing else.
   *
   * Not a row in §7's printed matrix, and that is a deliberate, narrow addition
   * rather than an oversight (M14; carry it into the doc). FR26 requires the
   * second parent's second interaction to be picking their own avatar and
   * colour, and at that moment they hold the `adult` column, where
   * `member:manage` is `deny` — correctly so, since managing members and roles
   * is owner-only. Without this cell the zero-data-entry flow would have to
   * either escalate the invitee or skip the chokepoint, and both are worse than
   * naming the capability.
   *
   * Graded `own` for every account-backed role, so `decide()` resolves it
   * against `ownerMemberId` and it can never reach another person's row. The
   * kiosk is `deny`: a wall tablet is physically unauthenticated (§7), and it
   * has no "own" member to be in the first place.
   */
  'member:self': {
    owner: 'own',
    adult: 'own',
    child: 'own',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'routine:write': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'completion:write': {
    owner: 'allow',
    adult: 'allow',
    child: 'allow',
    contributor: 'scoped',
    viewer: 'deny',
    device: 'allow',
  },
  /**
   * Author a task: write its title, its assignee, its due date, or remove it
   * outright (M24). A task used to piggyback on `routine:write` on the theory
   * that "a task is a chore" — true of *authoring* one, but the matrix has no
   * row for *finishing* a routine step either, and that split
   * (`routine:write` vs. `completion:write`) is exactly the shape a task
   * needs too: the wall display is coming for tasks next, and the hub may
   * tick a box without ever being trusted to invent or delete a household's
   * list. So `task:write` takes over routine:write's own grade verbatim —
   * owner/adult `allow`, everyone else `deny` — and `task:complete` below
   * takes the completion half.
   */
  'task:write': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  /**
   * Tick a task done, or take it back — the one write a kiosk or a child may
   * make against a task, mirroring `completion:write`'s child/device `allow`
   * (a tap on the hub, or a child signed into the household's own view). The
   * `contributor` cell is `deny`, not `scoped` like `completion:write`: a
   * caregiver share link ticks routine steps through
   * `POST /api/share/completions`, a dedicated route that resolves the
   * `memberId` the scope check needs, and no equivalent exists for tasks yet
   * (a task's owner is its assignee, not "the member whose day this is"). Add
   * the route before promoting this cell — don't grade a capability for a
   * surface that cannot reach it.
   */
  'task:complete': {
    owner: 'allow',
    adult: 'allow',
    child: 'allow',
    contributor: 'deny',
    viewer: 'deny',
    device: 'allow',
  },
  'stars:award': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'stars:remove': {
    owner: 'deny',
    adult: 'deny',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'redemption:request': {
    owner: 'allow',
    adult: 'allow',
    child: 'allow',
    contributor: 'deny',
    viewer: 'deny',
    device: 'allow',
  },
  'redemption:approve': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'reward:manage': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'device:manage': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'share:manage': {
    owner: 'allow',
    adult: 'allow',
    child: 'deny',
    contributor: 'deny',
    viewer: 'deny',
    device: 'deny',
  },
  'timer:control': {
    owner: 'allow',
    adult: 'allow',
    child: 'allow',
    contributor: 'scoped',
    viewer: 'deny',
    device: 'allow',
  },
};

/**
 * Maps a principal onto a matrix column. A member row with `role: 'caregiver'`
 * — an account-holding babysitter — gets the caregiver *contributor* column:
 * same capabilities, but scoped by nothing, so `scoped` grades resolve against
 * the resource's family only.
 */
function columnFor(principal: Principal): Column {
  switch (principal.kind) {
    case 'device':
      return 'device';
    case 'share':
      return principal.role === 'contributor' ? 'contributor' : 'viewer';
    case 'member':
      switch (principal.role) {
        case 'owner':
          return 'owner';
        case 'adult':
          return 'adult';
        case 'child':
          return 'child';
        case 'caregiver':
          return 'contributor';
      }
  }
}

/** The raw matrix cell — before the resource is taken into account. */
export function grade(principal: Principal, capability: Capability): Grade {
  return MATRIX[capability][columnFor(principal)];
}

/**
 * The resolved decision for a concrete resource. Fails closed: a conditional
 * grade with no resource to test against becomes `deny`.
 */
export function decide(principal: Principal, capability: Capability, resource?: Resource): Grade {
  const cell = grade(principal, capability);

  if (cell === 'deny') return 'deny';

  // Family scoping is absolute: no principal ever reaches another household.
  if (resource && resource.familyId !== principal.familyId) return 'deny';

  if (cell === 'allow' || cell === 'busy-only') return cell;

  if (!resource) return 'deny';

  if (cell === 'own') {
    const isOwn =
      principal.kind === 'member' &&
      !!resource.ownerMemberId &&
      resource.ownerMemberId === principal.memberId;
    return isOwn ? 'allow' : 'deny';
  }

  // cell === 'scoped'
  if (principal.kind !== 'share') return 'allow';

  const { memberIds, calendarIds } = principal.scope;
  // Fails closed: a scoped principal restricted to specific members must be
  // denied when the resource carries no subject to check the restriction
  // against — an absent memberId is not "unrestricted", it is untestable.
  const memberOk =
    memberIds === undefined || (!!resource.memberId && memberIds.includes(resource.memberId));
  // Same reading, mirrored: a calendar-restricted link denied a resource with
  // no `calendarId` to test — untestable is not unrestricted, matching
  // `sharing/domain/scope.ts`'s `coversCalendar()`, which fails closed on
  // exactly this case (a native event has no calendar to test against).
  const calendarOk =
    calendarIds === undefined ||
    (!!resource.calendarId && calendarIds.includes(resource.calendarId));

  return memberOk && calendarOk ? 'allow' : 'deny';
}

/**
 * The chokepoint. `true` only for a full grant — `busy-only` is not a grant,
 * callers that render free/busy must ask `decide()` explicitly.
 */
export function can(principal: Principal, capability: Capability, resource?: Resource): boolean {
  return decide(principal, capability, resource) === 'allow';
}

/**
 * `can()` for a capability that grades `own` for the caller's own resources
 * (`calendar:view_private`, `google:link`, …) — resolves `ownerMemberId` from
 * the principal itself, so the call site does not have to reconstruct the
 * "own" resource shape by hand. A non-`member` principal (device, share link)
 * can never be an owner, so it resolves to `null` — `decide()` treats an
 * absent `ownerMemberId` as untestable and fails closed regardless, but
 * `null` makes "there is no member id to be the owner" explicit rather than
 * relying on `undefined` doing the same thing by accident.
 */
export function canOwn(principal: Principal, capability: Capability): boolean {
  const ownerMemberId = principal.kind === 'member' ? principal.memberId : null;
  return can(principal, capability, { familyId: principal.familyId, ownerMemberId });
}

export class ForbiddenError extends Error {
  readonly capability: Capability;

  constructor(capability: Capability) {
    super(`Not permitted: ${capability}`);
    this.name = 'ForbiddenError';
    this.capability = capability;
  }
}
