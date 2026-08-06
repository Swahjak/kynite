import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * `google_account.googleUserId` uniqueness (M04, relaxed): the same Google
 * identity may link into more than one family — the divorced-parent persona,
 * where a parent belongs to two households — but only once per family. See
 * `docs/architecture.md` §3 and `src/modules/google/schema.ts`.
 */
describe.skipIf(!databaseUrl)('google account uniqueness (integration)', () => {
  const { pool, db } = createTestDb();
  const { googleAccount, family } = schema;

  let householdA: Household;
  let householdB: Household;

  beforeAll(async () => {
    householdA = await seedHousehold(db, 'GoogleA');
    householdB = await seedHousehold(db, 'GoogleB');
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, householdA.familyId));
    await db.delete(family).where(eq(family.id, householdB.familyId));
    await pool.end();
  });

  it('allows the same googleUserId to link into two different families', async () => {
    const googleUserId = `google-${randomUUID()}`;

    const [accountA] = await db
      .insert(googleAccount)
      .values({
        familyId: householdA.familyId,
        ownerMemberId: householdA.parentId,
        googleUserId,
        email: 'shared-parent@example.test',
      })
      .returning();

    const [accountB] = await db
      .insert(googleAccount)
      .values({
        familyId: householdB.familyId,
        ownerMemberId: householdB.parentId,
        googleUserId,
        email: 'shared-parent@example.test',
      })
      .returning();

    expect(accountA.familyId).toBe(householdA.familyId);
    expect(accountB.familyId).toBe(householdB.familyId);
    expect(accountA.googleUserId).toBe(accountB.googleUserId);
  });

  it('rejects linking the same googleUserId twice within one family', async () => {
    const googleUserId = `google-${randomUUID()}`;

    await db.insert(googleAccount).values({
      familyId: householdA.familyId,
      ownerMemberId: householdA.parentId,
      googleUserId,
      email: 'first@example.test',
    });

    await expectRejection(
      db.insert(googleAccount).values({
        familyId: householdA.familyId,
        ownerMemberId: householdA.parentId,
        googleUserId,
        email: 'second@example.test',
      }),
      /google_account_family_google_user_unique/
    );
  });
});
