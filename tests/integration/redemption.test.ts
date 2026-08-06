import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The redemption flow, running for real (M08).
 *
 * `tests/unit/rewards/*` prove the pure state machine and
 * `tests/integration/star-ledger.test.ts` proves the balance view's own
 * arithmetic. Neither proves that the *actions* — resolving a real principal,
 * writing real rows — move stars only when they should. Three claims are
 * settled here and nowhere else:
 *
 *   1. **A denial changes nothing.** Not the balance, not the ledger, not by a
 *      single row. Asserted as a byte-for-byte comparison of the whole ledger
 *      and the whole balance before and after, rather than as "the number is
 *      still 10" — a penalty introduced later would have to be invisible in
 *      *both* to slip through.
 *   2. **A double tap creates one request.** Through the derived `clientId`
 *      and, independently, through the partial open-request unique index when
 *      a second device mints its own key.
 *   3. **Approval spends without touching the ledger.** Earned stars come out
 *      of the transaction identical; only the derived number moves.
 *
 * The only fakes are framework seams (session, cache, locale); `can()`,
 * `getPrincipal()`, the reads and the writes are real.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
// The actions import `@/modules/family`, whose barrel re-exports client
// components — which drags next-intl's client navigation into a plain Node run.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const {
  awardStarsAction,
  decideRedemptionAction,
  fulfillRedemptionAction,
  requestRedemptionAction,
} = await import('@/modules/rewards/actions');

// Integration tests hit a real Postgres, so a cold connection is more likely to
// bump the 5s unit default than an actual hang.
vi.setConfig({ testTimeout: 20_000 });

const DAY = '2026-03-11';

describe.skipIf(!databaseUrl)('redemption (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, memberStarBalance, redemption, reward, starLedger } = schema;

  let household: Household;
  let cheapRewardId: string;
  let dearRewardId: string;

  const decide = (redemptionId: string, decision: 'approve' | 'deny') => {
    const form = new FormData();
    form.set('redemptionId', redemptionId);
    form.set('decision', decision);
    return decideRedemptionAction({ status: 'idle' }, form);
  };

  const fulfill = (redemptionId: string) => {
    const form = new FormData();
    form.set('redemptionId', redemptionId);
    return fulfillRedemptionAction({ status: 'idle' }, form);
  };

  const award = (memberId: string, amount: number) => {
    const form = new FormData();
    form.set('memberId', memberId);
    form.set('amount', String(amount));
    form.set('reason', 'surprise');
    return awardStarsAction({ status: 'idle' }, form);
  };

  const ask = (overrides: Partial<Parameters<typeof requestRedemptionAction>[0]> = {}) =>
    requestRedemptionAction({
      rewardId: cheapRewardId,
      memberId: household.childId,
      clientId: `redeem:${household.childId}:${cheapRewardId}:${DAY}`,
      ...overrides,
    });

  const balanceOf = async (memberId: string) => {
    const [row] = await db
      .select()
      .from(memberStarBalance)
      .where(eq(memberStarBalance.memberId, memberId));
    return row;
  };

  const ledgerOf = async (memberId: string) =>
    db
      .select()
      .from(starLedger)
      .where(and(eq(starLedger.familyId, household.familyId), eq(starLedger.memberId, memberId)))
      .orderBy(starLedger.createdAt);

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Redemptions');

    const created = await db
      .insert(reward)
      .values([
        {
          familyId: household.familyId,
          title: 'Extra verhaaltje',
          costStars: 3,
          category: 'privilege',
        },
        {
          familyId: household.familyId,
          title: 'Naar de dierentuin',
          costStars: 30,
          category: 'experience',
        },
      ])
      .returning({ id: reward.id });

    cheapRewardId = created[0].id;
    dearRewardId = created[1].id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    await db.delete(redemption).where(eq(redemption.familyId, household.familyId));
    await db.delete(starLedger).where(eq(starLedger.familyId, household.familyId));
    await db.delete(schema.eventLog).where(eq(schema.eventLog.familyId, household.familyId));

    // A balance to spend from: 10 earned, nothing spent.
    await db.insert(starLedger).values({
      familyId: household.familyId,
      memberId: household.childId,
      amount: 10,
      reason: 'routine',
    });
  });

  /* ---------------------------------------------------------------------- */

  it('records a request without moving a single star', async () => {
    const before = await balanceOf(household.childId);

    expect(await ask()).toEqual({ status: 'requested', replayed: false });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'requested',
      costStars: 3,
      memberId: household.childId,
      decidedAt: null,
      decidedByMemberId: null,
    });

    // Asking is a question, not a purchase.
    expect(await balanceOf(household.childId)).toEqual(before);
  });

  it('publishes redemption.requested inside the same transaction', async () => {
    await ask();

    const log = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId));

    expect(log.map((row) => row.type)).toEqual(['redemption.requested']);
  });

  it('creates one request on a replayed clientId', async () => {
    expect(await ask()).toEqual({ status: 'requested', replayed: false });
    expect(await ask()).toEqual({ status: 'requested', replayed: true });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    expect(rows).toHaveLength(1);
  });

  it('creates one request on a double tap that mints a fresh clientId', async () => {
    // A second device, or a client whose derivation changed: the partial
    // unique index on (member, reward) where status = 'requested' is what
    // catches this one, not the idempotency key.
    await ask();
    const second = await ask({ clientId: `redeem:other-device:${cheapRewardId}:${DAY}` });

    expect(second).toEqual({ status: 'requested', replayed: true });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    expect(rows).toHaveLength(1);
  });

  /* ---------------------------------------------------------------------- */

  it('deducts on approval — and the ledger comes out identical', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    const ledgerBefore = await ledgerOf(household.childId);

    expect(await decide(request.id, 'approve')).toEqual({ status: 'idle' });

    const balance = await balanceOf(household.childId);
    expect(balance.earnedStars).toBe(10);
    expect(balance.spentStars).toBe(3);
    expect(balance.availableStars).toBe(7);

    // Spending is a redemption row, never a ledger row. Not "one fewer row" —
    // the *same* rows, unchanged.
    expect(await ledgerOf(household.childId)).toEqual(ledgerBefore);
  });

  it('stays spent once handed over', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    await decide(request.id, 'approve');
    expect(await fulfill(request.id)).toEqual({ status: 'idle' });

    const [row] = await db.select().from(redemption).where(eq(redemption.id, request.id));
    expect(row.status).toBe('fulfilled');
    expect((await balanceOf(household.childId)).availableStars).toBe(7);
  });

  it('refuses to hand over something that was never approved', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    expect(await fulfill(request.id)).toEqual({ status: 'error', error: 'redemptionNotFound' });
    expect((await balanceOf(household.childId)).availableStars).toBe(10);
  });

  /* ---------------------------------------------------------------------- */

  it('a denial leaves the balance and the ledger untouched — no penalty exists', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    const balanceBefore = await balanceOf(household.childId);
    const ledgerBefore = await ledgerOf(household.childId);

    expect(await decide(request.id, 'deny')).toEqual({ status: 'idle' });

    const [row] = await db.select().from(redemption).where(eq(redemption.id, request.id));
    expect(row.status).toBe('denied');
    expect(row.decidedByMemberId).toBe(household.parentId);

    // Every number, not just the interesting one.
    expect(await balanceOf(household.childId)).toEqual(balanceBefore);
    expect(await ledgerOf(household.childId)).toEqual(ledgerBefore);
  });

  it('a denial writes no ledger row of any kind — not even a zero or a note', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    await decide(request.id, 'deny');

    const ledger = await ledgerOf(household.childId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ amount: 10, reason: 'routine' });
    // No compensating entry, no annotation of the denial anywhere in history.
    expect(ledger.some((entry) => entry.redemptionId !== null)).toBe(false);
  });

  it('lets the same reward be asked for again after a denial', async () => {
    await ask();
    const [first] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    await decide(first.id, 'deny');

    // A new day, so a new derived key; the open-request index no longer
    // blocks it because the previous row is terminal.
    expect(
      await ask({ clientId: `redeem:${household.childId}:${cheapRewardId}:2026-03-12` })
    ).toEqual({ status: 'requested', replayed: false });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    expect(rows.map((row) => row.status).sort()).toEqual(['denied', 'requested']);
  });

  it('does not decide the same request twice', async () => {
    await ask();
    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    await decide(request.id, 'approve');
    expect(await decide(request.id, 'deny')).toEqual({ status: 'error', error: 'alreadyDecided' });

    const [row] = await db.select().from(redemption).where(eq(redemption.id, request.id));
    expect(row.status).toBe('approved');
  });

  it('serialises concurrent approvals on the same child — exactly one wins the race', async () => {
    // The bug this reproduces: two parents approving two *different* open
    // requests for the same child, at the same moment. Locking only the
    // redemption row (one each) is not enough under READ COMMITTED — both
    // transactions can read `member_star_balance` before either commits and
    // both pass the affordability check, driving `available` negative
    // (reproduced pre-fix: earned 10, spent 20, available −10). The fix locks
    // the *member* row before reading the balance, so the second transaction
    // blocks until the first commits and then re-reads a balance that already
    // reflects it.
    const [rewardA, rewardB] = await db
      .insert(reward)
      .values([
        { familyId: household.familyId, title: 'Racer A', costStars: 10, category: 'treat' },
        { familyId: household.familyId, title: 'Racer B', costStars: 10, category: 'treat' },
      ])
      .returning({ id: reward.id });

    await ask({ rewardId: rewardA.id, clientId: `redeem:race-a:${DAY}` });
    await ask({ rewardId: rewardB.id, clientId: `redeem:race-b:${DAY}` });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    const requestA = rows.find((row) => row.rewardId === rewardA.id)!;
    const requestB = rows.find((row) => row.rewardId === rewardB.id)!;

    // Both hit the action concurrently — two real transactions on two real
    // pooled connections, not two calls serialised by the JS event loop.
    const outcomes = await Promise.all([
      decide(requestA.id, 'approve'),
      decide(requestB.id, 'approve'),
    ]);

    const approved = outcomes.filter((outcome) => outcome.status === 'idle');
    const refused = outcomes.filter(
      (outcome) => outcome.status === 'error' && outcome.error === 'notEnoughStars'
    );

    // Exactly one approval survives — not "both, and the balance is wrong",
    // not "both refused".
    expect(approved).toHaveLength(1);
    expect(refused).toHaveLength(1);

    // 10 earned, one 10-star request granted: available lands on zero and
    // never dips below it, whichever request won the race.
    const balance = await balanceOf(household.childId);
    expect(balance.availableStars).toBe(0);

    await db.delete(reward).where(eq(reward.id, rewardA.id));
    await db.delete(reward).where(eq(reward.id, rewardB.id));
  });

  /* ---------------------------------------------------------------------- */

  it('refuses a request the child cannot afford', async () => {
    expect(
      await ask({
        rewardId: dearRewardId,
        clientId: `redeem:${household.childId}:${dearRewardId}:${DAY}`,
      })
    ).toEqual({ status: 'error', error: 'notEnoughStars' });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));
    expect(rows).toEqual([]);
  });

  it('refuses to approve the second of two requests the balance cannot cover', async () => {
    // 10 stars, two 3-star asks and then a 30-star one is not the interesting
    // case; two 6-star asks is. Seed a second affordable reward inline.
    const [six] = await db
      .insert(reward)
      .values({
        familyId: household.familyId,
        title: 'Zes sterren',
        costStars: 6,
        category: 'treat',
      })
      .returning({ id: reward.id });

    await ask({ rewardId: six.id, clientId: `redeem:a:${six.id}:${DAY}` });
    await ask({ clientId: `redeem:b:${cheapRewardId}:${DAY}` });

    const rows = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    const sixRequest = rows.find((row) => row.costStars === 6)!;
    const threeRequest = rows.find((row) => row.costStars === 3)!;

    expect(await decide(sixRequest.id, 'approve')).toEqual({ status: 'idle' });
    expect(await decide(threeRequest.id, 'approve')).toEqual({ status: 'idle' });

    // 6 + 3 = 9 of 10: both fit. Now a third would not.
    expect((await balanceOf(household.childId)).availableStars).toBe(1);

    const [another] = await db
      .insert(reward)
      .values({
        familyId: household.familyId,
        title: 'Nog zes',
        costStars: 6,
        category: 'treat',
      })
      .returning({ id: reward.id });

    // Requesting is already refused at 1 available — the guard at approval time
    // is proven by writing the row directly, as a second device racing would.
    const [racing] = await db
      .insert(redemption)
      .values({
        familyId: household.familyId,
        memberId: household.childId,
        rewardId: another.id,
        costStars: 6,
        status: 'requested',
      })
      .returning({ id: redemption.id });

    expect(await decide(racing.id, 'approve')).toEqual({
      status: 'error',
      error: 'notEnoughStars',
    });

    // Refused, not partially applied: still 1, never negative.
    expect((await balanceOf(household.childId)).availableStars).toBe(1);

    await db.delete(reward).where(eq(reward.id, six.id));
    await db.delete(reward).where(eq(reward.id, another.id));
  });

  it('refuses a reward from another family, however well-formed the id', async () => {
    const outsider = await seedHousehold(db, 'Outsiders');
    const [theirs] = await db
      .insert(reward)
      .values({
        familyId: outsider.familyId,
        title: 'Hun beloning',
        costStars: 1,
        category: 'treat',
      })
      .returning({ id: reward.id });

    expect(await ask({ rewardId: theirs.id, clientId: 'redeem:cross-family' })).toEqual({
      status: 'error',
      error: 'rewardNotFound',
    });

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('refuses a caller with no session at all', async () => {
    stubs.session = null;
    expect(await ask({ clientId: 'redeem:anonymous' })).toEqual({
      status: 'error',
      error: 'forbidden',
    });
  });

  it('lets a child ask, and refuses to let a child answer', async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.childId },
    };

    expect(await ask()).toEqual({ status: 'requested', replayed: false });

    const [request] = await db
      .select()
      .from(redemption)
      .where(eq(redemption.familyId, household.familyId));

    // `redemption:approve` is `deny` in the child column of the §7 matrix.
    expect(await decide(request.id, 'approve')).toEqual({ status: 'error', error: 'forbidden' });
    expect(await decide(request.id, 'deny')).toEqual({ status: 'error', error: 'forbidden' });

    const [row] = await db.select().from(redemption).where(eq(redemption.id, request.id));
    expect(row.status).toBe('requested');
  });

  /* ---------------------------------------------------------------------- */

  it('awards a surprise star and only ever adds', async () => {
    expect(await award(household.childId, 2)).toEqual({ status: 'idle' });

    const ledger = await ledgerOf(household.childId);
    expect(ledger).toHaveLength(2);
    expect(ledger[1]).toMatchObject({ amount: 2, reason: 'surprise' });

    const balance = await balanceOf(household.childId);
    expect(balance.earnedStars).toBe(12);
  });

  it('refuses a manual award of zero or below — there is no removal path', async () => {
    for (const amount of [0, -1, -100]) {
      const form = new FormData();
      form.set('memberId', household.childId);
      form.set('amount', String(amount));
      form.set('reason', 'manual');

      expect(await awardStarsAction({ status: 'idle' }, form)).toEqual({
        status: 'error',
        error: 'invalidInput',
      });
    }

    expect(await ledgerOf(household.childId)).toHaveLength(1);
  });

  it('refuses to award a star to another family, however well-formed the id', async () => {
    const outsider = await seedHousehold(db, 'Outsiders 2');

    expect(await award(outsider.childId, 3)).toEqual({
      status: 'error',
      error: 'memberNotFound',
    });

    const theirs = await db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, outsider.familyId));
    expect(theirs).toEqual([]);

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('does not let a child award themselves a star', async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.childId },
    };

    expect(await award(household.childId, 5)).toEqual({ status: 'error', error: 'forbidden' });
    expect(await ledgerOf(household.childId)).toHaveLength(1);
  });
});
