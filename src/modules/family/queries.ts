import 'server-only';
import { cache } from 'react';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { family, formerMember, member, type Family, type Member } from './schema';

/**
 * Reads for the family slice. Server-side only — the `server-only` import makes
 * that a build error rather than a convention: pulling this into a client
 * component would ship the database client (and its connection string) to the
 * browser.
 */

/**
 * `React.cache`d per request: `(app)/layout.tsx`, `(hub)/layout.tsx`,
 * `loadCalendarPage` and `getHouseholdFormattingLocale()` (the date/time
 * formatting split, `src/i18n/formatting-locale.ts`) each resolve the same
 * family row independently rather than threading it through props — this is
 * what keeps that from being one query per caller instead of one per request.
 * Safe across a mutation within the same render because nothing here ever
 * mutates and re-reads in one pass; a changed row is only ever seen on the
 * *next* request, after the Server Action's `revalidatePath`.
 */
export const getFamily = cache(async (familyId: string): Promise<Family | null> => {
  const [row] = await getDb().select().from(family).where(eq(family.id, familyId)).limit(1);
  return row ?? null;
});

/** Members in board order — `sortOrder` drives every per-person column in the UI. */
export async function listMembers(familyId: string): Promise<Member[]> {
  return getDb()
    .select()
    .from(member)
    .where(eq(member.familyId, familyId))
    .orderBy(asc(member.sortOrder), asc(member.createdAt));
}

export async function getMember(familyId: string, memberId: string): Promise<Member | null> {
  const rows = await getDb().select().from(member).where(eq(member.id, memberId)).limit(1);
  const row = rows[0];
  return row && row.familyId === familyId ? row : null;
}

export async function getMemberByUserId(userId: string): Promise<Member | null> {
  const [row] = await getDb().select().from(member).where(eq(member.userId, userId)).limit(1);
  return row ?? null;
}

/**
 * Has this login ever held a member row? (M19, F4.)
 *
 * The question `(auth)/onboarding` has to answer before it offers to create a
 * household: a session with no principal is a *social first run* only if the
 * user has never been a member of anything. A removed second parent presents
 * the identical state — valid session, no member row — and must not be sent
 * down the owner-creation path, so both the live rows and the tombstones
 * `deleteMemberAction` leaves behind are consulted.
 */
export async function hasEverBeenMember(userId: string): Promise<boolean> {
  const db = getDb();

  const [live] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId))
    .limit(1);
  if (live) return true;

  const [removed] = await db
    .select({ id: formerMember.id })
    .from(formerMember)
    .where(eq(formerMember.userId, userId))
    .limit(1);

  return Boolean(removed);
}
