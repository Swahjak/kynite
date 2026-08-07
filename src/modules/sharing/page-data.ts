import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Table objects from the schema assembly point, not `@/modules/google` — that
// barrel re-exports client components (see the same note in
// `modules/calendar/page-data.ts`).
import { calendar } from '@/server/db/schema';
import { can, getPrincipal, listMembers } from '@/modules/family';
import { shareLinkStateOf, type ShareLinkScope, type ShareLinkState } from './domain/scope';
import { listShareLinks } from './queries';
import type { ShareLinkRole } from './schema';

/**
 * The server-side read `(app)/settings/sharing` composes (architecture §2 rule
 * 4: route files hold no logic).
 *
 * Member-only, and refused outright for anything else rather than left to the
 * `share:manage` cell alone. The same reasoning as `loadDevicesPage`: a list of
 * every open door into a household — with how often each has been walked
 * through — is not something to render on a wall tablet, and a share link that
 * could enumerate its siblings would be a link that could tell a babysitter
 * which other babysitters exist.
 */

export type ShareLinkView = {
  id: string;
  role: ShareLinkRole;
  scope: ShareLinkScope;
  label: string | null;
  state: ShareLinkState;
  /** Epoch milliseconds — a Date arrives at a client component as a string. */
  createdAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
  /** The telemetry the criterion names: when it was last opened, and how often. */
  lastUsedAt: number | null;
  useCount: number;
  /** Display names for `scope.memberIds`, resolved here so the UI shows people. */
  memberNames: string[];
};

export type SharingPageData = {
  familyId: string;
  links: ShareLinkView[];
  members: { id: string; displayName: string }[];
  calendars: { id: string; summary: string }[];
  /** The server's clock: "last opened 3 days ago" must not be the phone's guess. */
  serverNow: number;
  canManage: boolean;
};

export async function loadSharingPage(): Promise<SharingPageData | null> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return null;

  const now = new Date();

  const [links, members, calendars] = await Promise.all([
    listShareLinks(principal.familyId),
    listMembers(principal.familyId),
    listShareableCalendars(principal.familyId),
  ]);

  const nameOf = new Map(members.map((entry) => [entry.id, entry.displayName]));

  return {
    familyId: principal.familyId,
    links: links.map((link) => ({
      id: link.id,
      role: link.role,
      scope: link.scope,
      label: link.label,
      state: shareLinkStateOf(link, now),
      createdAt: link.createdAt.getTime(),
      expiresAt: link.expiresAt ? link.expiresAt.getTime() : null,
      revokedAt: link.revokedAt ? link.revokedAt.getTime() : null,
      lastUsedAt: link.lastUsedAt ? link.lastUsedAt.getTime() : null,
      useCount: link.useCount,
      memberNames: (link.scope.memberIds ?? []).flatMap((id) => {
        const name = nameOf.get(id);
        return name ? [name] : [];
      }),
    })),
    members: members.map((entry) => ({ id: entry.id, displayName: entry.displayName })),
    calendars,
    serverNow: now.getTime(),
    canManage: can(principal, 'share:manage', { familyId: principal.familyId }),
  };
}

/**
 * The calendars a link may be scoped to: synced ones, writable or not.
 *
 * Private calendars are included on purpose — scoping a link *to* a private
 * calendar does not reveal its detail, because §7 grades
 * `calendar:view_private` as `deny` for both share roles and the events come
 * back free/busy regardless. Excluding them would instead mean a caregiver
 * silently missing that the house is out on Thursday evening.
 */
async function listShareableCalendars(
  familyId: string
): Promise<{ id: string; summary: string }[]> {
  return getDb()
    .select({ id: calendar.id, summary: calendar.summary })
    .from(calendar)
    .where(and(eq(calendar.familyId, familyId), eq(calendar.syncEnabled, true)))
    .orderBy(asc(calendar.summary));
}
