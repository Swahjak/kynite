import { cache } from 'react';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { getAuth } from '@/server/auth';
import { getDb } from '@/server/db';
import { ForbiddenError, can, type Capability, type Principal, type Resource } from './authorize';
import { member } from './schema';

/**
 * Request principal resolution (server-side only).
 *
 * The session cookie carries `activeFamilyId` + `memberId`, so scoping is a
 * cookie read. The member's *role* is read from the database: a demoted parent
 * must lose their powers on the next request, not when the cookie cache
 * expires. It is a primary-key lookup, memoised per request by `React.cache`.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });

  const familyId = session?.session.activeFamilyId;
  const memberId = session?.session.memberId;
  if (!familyId || !memberId) return null;

  const [row] = await getDb()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.familyId, familyId)))
    .limit(1);

  if (!row) return null;

  return { kind: 'member', familyId, memberId, role: row.role };
});

/** Throws `ForbiddenError` unless the caller may perform `capability`. */
export async function assertCan(
  capability: Capability,
  resource?: Omit<Resource, 'familyId'> & { familyId?: string }
): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new ForbiddenError(capability);

  const target: Resource = { familyId: principal.familyId, ...resource };

  if (!can(principal, capability, target)) throw new ForbiddenError(capability);

  return principal;
}
