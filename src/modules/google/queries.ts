import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { calendar, googleAccount, type Calendar, type GoogleAccount } from './schema';

/**
 * Reads for the Google slice. `server-only`: these touch the database and the
 * rows carry (encrypted) tokens, which must never be serialised into a client
 * bundle.
 */

/** A linked account without its secrets — the shape the settings UI renders. */
export type LinkedAccount = {
  id: string;
  email: string;
  googleUserId: string;
  ownerMemberId: string;
  status: GoogleAccount['status'];
  scopes: string[];
  calendars: Calendar[];
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
    })
    .from(googleAccount)
    .where(eq(googleAccount.familyId, familyId))
    .orderBy(asc(googleAccount.createdAt));

  if (accounts.length === 0) return [];

  const calendars = await db
    .select()
    .from(calendar)
    .where(eq(calendar.familyId, familyId))
    .orderBy(asc(calendar.summary));

  return accounts.map((account) => ({
    ...account,
    calendars: calendars.filter((row) => row.googleAccountId === account.id),
  }));
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
