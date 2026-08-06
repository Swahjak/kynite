import { asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { family, member, type Family, type Member } from './schema';

/** Reads for the family slice. Server-side only — never imported by a client component. */

export async function getFamily(familyId: string): Promise<Family | null> {
  const [row] = await getDb().select().from(family).where(eq(family.id, familyId)).limit(1);
  return row ?? null;
}

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
