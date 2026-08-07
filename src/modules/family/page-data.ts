import 'server-only';
import { can } from './authorize';
import { listInvites } from './invites';
import { getPrincipal } from './principal';
import { listMembers, getFamily } from './queries';
import type { Family, Member } from './schema';
import type { MemberInviteView } from './ui/member-invite';

/**
 * Everything `(app)/family` renders, in one server-side read.
 *
 * The same shape as `modules/sharing/page-data.ts`, and for the same two
 * reasons. First, the page component stays a layout: no principal juggling, no
 * date arithmetic, no conditional queries in the middle of JSX. Second — and
 * this is the one that actually forces the file — reading the clock is impure,
 * and React's purity rule (correctly) refuses `Date.now()` during render. The
 * server's now has to be *captured* somewhere that is not a component and then
 * handed down, or every invite countdown would be a re-render hazard.
 *
 * Dates cross into client components as epoch ms, never as `Date` objects.
 */
export type FamilyPageData = {
  family: Family | null;
  members: Member[];
  /** Latest invite per member id. Empty for anyone without `member:manage`. */
  invites: Record<string, MemberInviteView>;
  serverNow: number;
  /** Owner-only (`member:manage`) — gates the roster's CRUD affordances. */
  canManage: boolean;
};

export async function loadFamilyPage(): Promise<FamilyPageData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  // Invites are owner-only (`member:manage`), so an adult gets the roster
  // without them rather than buttons whose actions would refuse them.
  const canManage = can(principal, 'member:manage', { familyId: principal.familyId });

  const [family, members, rows] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
    canManage ? listInvites(principal.familyId) : Promise.resolve([]),
  ]);

  // `listInvites` is newest-first, so the first row seen for a member wins: an
  // owner who let one lapse and minted another sees the live one, not the corpse.
  const invites: Record<string, MemberInviteView> = {};
  for (const invite of rows) {
    invites[invite.memberId] ??= {
      id: invite.id,
      email: invite.email,
      expiresAt: invite.expiresAt.getTime(),
      claimedAt: invite.claimedAt?.getTime() ?? null,
      revokedAt: invite.revokedAt?.getTime() ?? null,
    };
  }

  return { family, members, invites, serverNow: Date.now(), canManage };
}

/**
 * The household section of `(app)/settings` (M16).
 *
 * Separate from `loadFamilyPage` rather than folded into it: the roster page
 * needs members and invites and nothing about timezones, and the settings hub
 * needs the household row and two capability answers on every section it
 * draws. Reading both everywhere would mean every surface paying for the
 * other's queries.
 *
 * The capability flags are resolved here, once, and handed down as props. A
 * section whose action would refuse the caller is not rendered disabled — it
 * is not rendered, which is the same rule `loadFamilyPage` follows for
 * invites: offering a control that can only fail is worse than not offering it.
 */
export type FamilySettingsData = {
  family: Family | null;
  /** Owner-only: name, locale, timezone, week start, deletion (`family:manage`). */
  canManageFamily: boolean;
  /** Both parents: hub board, calendar colours and visibility (`display:manage`). */
  canManageDisplay: boolean;
  /** Owner-only: adding, editing and removing members (`member:manage`, NB-7). */
  canManageMembers: boolean;
  /** The caller's own member id — the subject of the per-person sections. */
  memberId: string;
};

export async function loadFamilySettings(): Promise<FamilySettingsData | null> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return null;

  return {
    family: await getFamily(principal.familyId),
    canManageFamily: can(principal, 'family:manage', { familyId: principal.familyId }),
    canManageDisplay: can(principal, 'display:manage', { familyId: principal.familyId }),
    canManageMembers: can(principal, 'member:manage', { familyId: principal.familyId }),
    memberId: principal.memberId,
  };
}
