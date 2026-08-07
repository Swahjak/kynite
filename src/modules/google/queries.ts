import 'server-only';
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The `event` table from the schema assembly point rather than the calendar
// barrel — the same note (and the same import-cycle reason) as `store.ts`.
import { event } from '@/server/db/schema';
import { CALENDAR_SCOPE } from './config';
import { calendar, googleAccount, type Calendar, type GoogleAccount } from './schema';

/**
 * Reads for the Google slice. `server-only`: these touch the database and the
 * rows carry (encrypted) tokens, which must never be serialised into a client
 * bundle.
 */

/** A calendar as the settings UI renders it: the row plus what hangs off it. */
export type LinkedCalendar = Calendar & {
  /**
   * How many live events came from this calendar (M18). It is the number a
   * parent is shown *before* they confirm a removal, and it is the whole
   * difference between "remove this calendar" and an informed decision.
   * Soft-deleted rows are excluded — a tombstone is already gone.
   */
  eventCount: number;
};

/** A linked account without its secrets — the shape the settings UI renders. */
export type LinkedAccount = {
  id: string;
  email: string;
  googleUserId: string;
  ownerMemberId: string;
  status: GoogleAccount['status'];
  scopes: string[];
  /** When this identity was linked — the "linked since" badge (M18). */
  linkedAt: Date;
  /** True when the grant actually includes calendar scope (M18). */
  hasCalendarAccess: boolean;
  calendars: LinkedCalendar[];
  /** The sum over `calendars`, for the unlink confirmation. */
  eventCount: number;
  /**
   * The most recent successful sync across this account's calendars, or null
   * if none of them has ever completed one.
   */
  lastSyncedAt: Date | null;
};

export async function listLinkedAccounts(familyId: string): Promise<LinkedAccount[]> {
  const db = getDb();

  const accounts = await db
    .select({
      id: googleAccount.id,
      email: googleAccount.email,
      googleUserId: googleAccount.googleUserId,
      ownerMemberId: googleAccount.ownerMemberId,
      status: googleAccount.status,
      scopes: googleAccount.scopes,
      linkedAt: googleAccount.createdAt,
    })
    .from(googleAccount)
    .where(eq(googleAccount.familyId, familyId))
    .orderBy(asc(googleAccount.createdAt));

  if (accounts.length === 0) return [];

  const [calendars, counts] = await Promise.all([
    db
      .select()
      .from(calendar)
      .where(eq(calendar.familyId, familyId))
      .orderBy(asc(calendar.summary)),
    countEventsByCalendar(familyId),
  ]);

  return accounts.map((account) => {
    const own: LinkedCalendar[] = calendars
      .filter((row) => row.googleAccountId === account.id)
      .map((row) => ({ ...row, eventCount: counts.get(row.id) ?? 0 }));

    const syncedAts = own
      .map((row) => row.syncedAt)
      .filter((value): value is Date => value !== null);

    return {
      ...account,
      hasCalendarAccess: account.scopes.some((scope) => scope === CALENDAR_SCOPE),
      calendars: own,
      eventCount: own.reduce((total, row) => total + row.eventCount, 0),
      lastSyncedAt:
        syncedAts.length === 0
          ? null
          : syncedAts.reduce((latest, value) => (value > latest ? value : latest)),
    };
  });
}

/**
 * Live event counts per calendar, in one grouped query (M18).
 *
 * One round trip for the whole settings page rather than one per calendar: the
 * page renders every calendar of every linked account, and the count is only
 * ever read as "how much disappears if I remove this".
 */
export async function countEventsByCalendar(familyId: string): Promise<Map<string, number>> {
  const rows = await getDb()
    .select({ calendarId: event.calendarId, total: count() })
    .from(event)
    .where(
      and(
        eq(event.familyId, familyId),
        isNull(event.deletedAt),
        sql`${event.calendarId} is not null`
      )
    )
    .groupBy(event.calendarId);

  const byCalendar = new Map<string, number>();
  for (const row of rows) {
    if (row.calendarId) byCalendar.set(row.calendarId, Number(row.total));
  }
  return byCalendar;
}

/**
 * M04 carry-forward: `google_user_id` is unique *per family*, so "is this
 * identity already linked?" must be asked with the family in the predicate.
 * Asking globally would refuse the divorced-parent persona a second household.
 */
export async function findAccountByGoogleUserId(
  familyId: string,
  googleUserId: string
): Promise<GoogleAccount | null> {
  const [row] = await getDb()
    .select()
    .from(googleAccount)
    .where(and(eq(googleAccount.familyId, familyId), eq(googleAccount.googleUserId, googleUserId)))
    .limit(1);

  return row ?? null;
}

/** Drives the "reconnect your Google account" banner (§5 `invalid_grant`). */
export type ReauthRequiredAccount = Pick<GoogleAccount, 'id' | 'email' | 'status'>;

export async function listReauthRequiredAccounts(
  familyId: string
): Promise<ReauthRequiredAccount[]> {
  // Explicit columns only — this row set feeds a client-facing banner, and
  // `googleAccount` also carries `accessToken`/`refreshToken` ciphertext that
  // must never leave the query layer, `select()`-with-no-args included.
  return getDb()
    .select({ id: googleAccount.id, email: googleAccount.email, status: googleAccount.status })
    .from(googleAccount)
    .where(and(eq(googleAccount.familyId, familyId), eq(googleAccount.status, 'reauth_required')));
}

/**
 * The webhook's one lookup. Indexed by `channel_id`? No — a family has a
 * handful of calendars, and a partial index on a nullable, high-churn column
 * buys nothing at this scale; the row is found by a sequential scan over a
 * table measured in tens of rows. Revisit if Kynite becomes multi-tenant.
 */
export async function findCalendarByChannelId(channelId: string): Promise<Calendar | null> {
  const [row] = await getDb()
    .select()
    .from(calendar)
    .where(eq(calendar.channelId, channelId))
    .limit(1);

  return row ?? null;
}

export async function listFamilyCalendars(familyId: string): Promise<Calendar[]> {
  return getDb()
    .select()
    .from(calendar)
    .where(eq(calendar.familyId, familyId))
    .orderBy(asc(calendar.summary));
}
