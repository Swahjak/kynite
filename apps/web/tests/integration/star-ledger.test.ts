import { and, eq, sql } from 'drizzle-orm';
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
 * The star invariant, proven where it is actually enforced (M04):
 * `CHECK (amount > 0)` in the database, and a derived balance view — so no
 * Server Action, migration or console session can lower earned stars.
 */
describe.skipIf(!databaseUrl)('star ledger (integration)', () => {
  const { pool, db } = createTestDb();
  const { starLedger, redemption, reward, memberStarBalance, family } = schema;

  let household: Household;
  let rewardId: string;

  beforeAll(async () => {
    household = await seedHousehold(db, 'Stars');

    const [created] = await db
      .insert(reward)
      .values({
        familyId: household.familyId,
        title: 'Movie night',
        costStars: 4,
        category: 'experience',
      })
      .returning();
    rewardId = created.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  it('rejects an award of zero stars', async () => {
    await expectRejection(
      db.insert(starLedger).values({
        familyId: household.familyId,
        memberId: household.childId,
        amount: 0,
        reason: 'manual',
      }),
      /star_ledger_amount_positive/
    );
  });

  it('rejects a negative award — there is no star removal', async () => {
    await expectRejection(
      db.insert(starLedger).values({
        familyId: household.familyId,
        memberId: household.childId,
        amount: -5,
        reason: 'manual',
      }),
      /star_ledger_amount_positive/
    );
  });

  it('rejects rewriting an existing award into a non-positive one', async () => {
    const [row] = await db
      .insert(starLedger)
      .values({
        familyId: household.familyId,
        memberId: household.siblingId,
        amount: 1,
        reason: 'bonus',
      })
      .returning();

    await expectRejection(
      db.update(starLedger).set({ amount: -1 }).where(eq(starLedger.id, row.id)),
      /star_ledger_amount_positive/
    );

    await db.delete(starLedger).where(eq(starLedger.id, row.id));
  });

  it('derives the balance as earned minus approved-redemption cost', async () => {
    await db.insert(starLedger).values([
      { familyId: household.familyId, memberId: household.childId, amount: 3, reason: 'routine' },
      { familyId: household.familyId, memberId: household.childId, amount: 2, reason: 'bonus' },
    ]);

    await db.insert(redemption).values([
      // Approved: spends.
      {
        familyId: household.familyId,
        memberId: household.childId,
        rewardId,
        costStars: 4,
        status: 'approved',
        decidedAt: new Date(),
        decidedByMemberId: household.parentId,
      },
      // Requested and denied: cost nothing, stars stay available.
      {
        familyId: household.familyId,
        memberId: household.childId,
        rewardId,
        costStars: 100,
        status: 'requested',
      },
      {
        familyId: household.familyId,
        memberId: household.childId,
        rewardId,
        costStars: 100,
        status: 'denied',
        decidedAt: new Date(),
        decidedByMemberId: household.parentId,
      },
    ]);

    const [balance] = await db
      .select()
      .from(memberStarBalance)
      .where(eq(memberStarBalance.memberId, household.childId));

    expect(balance.earnedStars).toBe(5);
    expect(balance.spentStars).toBe(4);
    expect(balance.availableStars).toBe(1);
    expect(balance.familyId).toBe(household.familyId);
  });

  it('counts a fulfilled redemption as spent, and reports zeros for a member with no history', async () => {
    await db.insert(starLedger).values({
      familyId: household.familyId,
      memberId: household.siblingId,
      amount: 10,
      reason: 'routine',
    });
    await db.insert(redemption).values({
      familyId: household.familyId,
      memberId: household.siblingId,
      rewardId,
      costStars: 6,
      status: 'fulfilled',
      decidedAt: new Date(),
      decidedByMemberId: household.parentId,
    });

    const rows = await db
      .select()
      .from(memberStarBalance)
      .where(eq(memberStarBalance.familyId, household.familyId));

    const byMember = new Map(rows.map((row) => [row.memberId, row]));

    expect(byMember.get(household.siblingId)?.availableStars).toBe(4);
    // The parent has neither awards nor redemptions: 0, not a missing row.
    expect(byMember.get(household.parentId)).toMatchObject({
      earnedStars: 0,
      spentStars: 0,
      availableStars: 0,
    });
  });

  it('never lets earned stars go down, even as redemptions pile up', async () => {
    const earnedBefore = await db
      .select({ total: sql<number>`coalesce(sum(${starLedger.amount}), 0)::int` })
      .from(starLedger)
      .where(
        and(eq(starLedger.familyId, household.familyId), eq(starLedger.memberId, household.childId))
      );

    await db.insert(redemption).values({
      familyId: household.familyId,
      memberId: household.childId,
      rewardId,
      costStars: 1,
      status: 'approved',
      decidedAt: new Date(),
      decidedByMemberId: household.parentId,
    });

    const [balance] = await db
      .select()
      .from(memberStarBalance)
      .where(eq(memberStarBalance.memberId, household.childId));

    expect(balance.earnedStars).toBe(earnedBefore[0].total);
    // Spending moved only the derived number.
    expect(balance.availableStars).toBe(0);
  });
});
