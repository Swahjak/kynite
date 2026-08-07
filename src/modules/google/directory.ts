import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The schema assembly point, not a slice barrel — the same note as `store.ts`
// and `sync.ts`: a barrel re-exports client components, which must not enter a
// plain server module.
import { member, user } from '@/server/db/schema';
import { googleAccount } from './schema';
import type { MemberDirectory } from './domain/types';

/**
 * "Which email addresses belong to this household, and to whom" (M18).
 *
 * The read half of attendee attribution. Two sources, because a family member
 * can be reachable at either:
 *
 *  1. **`google_account.email`** — the address of a *linked calendar identity*,
 *     mapped to the member who owns that link. This is the one that matters in
 *     practice: it is the address a parent's own Google events are addressed to.
 *  2. **`user.email`** — the address the member signs in to Kynite with, joined
 *     through `member.user_id`. Often the same string; not always, and a second
 *     parent who signed up with a personal address and linked a work Google
 *     account has two.
 *
 * Children have neither (`member.user_id` is null and they link no accounts,
 * docs/architecture.md §3), so they are never matched — correctly: a child does
 * not appear in a Google attendee list because a child has no mailbox.
 *
 * Built once per sync pass rather than queried per attendee: a household is a
 * handful of rows, and a per-attendee round trip inside the item loop would
 * turn one calendar sync into hundreds of queries.
 */
export async function loadMemberDirectory(familyId: string): Promise<MemberDirectory> {
  const db = getDb();

  const [linked, accounts] = await Promise.all([
    db
      .select({ memberId: member.id, email: user.email })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.familyId, familyId)),
    db
      .select({ memberId: googleAccount.ownerMemberId, email: googleAccount.email })
      .from(googleAccount)
      .where(eq(googleAccount.familyId, familyId)),
  ]);

  const byEmail = new Map<string, string>();
  // Login addresses first, linked Google identities second: where the same
  // address somehow appears twice, the calendar identity is the more specific
  // claim and wins.
  for (const row of linked) {
    const email = row.email?.trim().toLowerCase();
    if (email) byEmail.set(email, row.memberId);
  }
  for (const row of accounts) {
    const email = row.email.trim().toLowerCase();
    if (email) byEmail.set(email, row.memberId);
  }

  return {
    memberIdFor(email: string): string | null {
      return byEmail.get(email.trim().toLowerCase()) ?? null;
    },
  };
}
