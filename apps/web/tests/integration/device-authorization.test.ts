import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { DEVICE_SESSION_COOKIE, deviceSessionExpiry, hashDeviceToken } from '@/lib/device-session';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * What a paired kiosk may and may not write (M12, §7 "Device (hub)" column).
 *
 * This is the criterion "a device session can write completions, timers and
 * redemption *requests*, and is rejected for settings, calendar edits, star
 * awards and approvals" — held as running actions rather than as a table.
 * `tests/unit/permissions.test.ts` already proves the matrix; what it cannot
 * prove is that a *device principal resolved from a real cookie* reaches those
 * cells, which is where the interesting failure lives: an action that
 * authorizes against the wrong subject, or a `can()` call that was never on the
 * device path at all.
 *
 * Every denial below is asserted twice — the action's own refusal, *and* the
 * absence of the row it would have written. A refusal that still writes is the
 * failure this suite exists for; "it returned an error" alone would not catch
 * it.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  cookies: new Map<string, string>(),
  enqueued: [] as { name: string }[],
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) =>
      stubs.cookies.has(name) ? { name, value: stubs.cookies.get(name)! } : undefined,
    set: (name: string, value: string) => stubs.cookies.set(name, value),
    delete: (name: string) => stubs.cookies.delete(name),
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/server/jobs/boss', () => ({
  enqueue: async (name: string) => {
    stubs.enqueued.push({ name });
    return 'job-id';
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.VAPID_PUBLIC_KEY ??= 'test-public-key';
process.env.VAPID_PRIVATE_KEY ??= 'test-private-key';
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

const { createMemberAction } = await import('@/modules/family/actions');
const { createEventAction } = await import('@/modules/calendar/actions');
const { awardStarsAction, decideRedemptionAction, requestRedemptionAction, createRewardAction } =
  await import('@/modules/rewards/actions');
const { createRoutineAction, completeStepAction } = await import('@/modules/routines/actions');
const { startTimerAction } = await import('@/modules/timers/actions');
const { createPairingCodeAction } = await import('@/modules/devices/actions');

vi.setConfig({ testTimeout: 20_000 });

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe.skipIf(!databaseUrl)('device session capability (integration)', () => {
  const { pool, db } = createTestDb();
  const { device, deviceSession, family, member, event, starLedger, redemption, routine, timer } =
    schema;

  let household: Household;
  let deviceId: string;

  beforeAll(() => {
    stubs.db = db;
  });

  beforeEach(async () => {
    household = await seedHousehold(db, 'Kiosk');

    // A real paired device: a row, a session whose token hash matches the
    // cookie, and no account session anywhere. Seeded directly rather than
    // through `pairDeviceAction` so this suite is about capability, not about
    // pairing (which `device-pairing.test.ts` owns).
    const [row] = await db
      .insert(device)
      .values({ familyId: household.familyId, name: 'Keuken', kind: 'hub' })
      .returning();
    deviceId = row.id;

    const token = `token-${row.id}`;
    await db.insert(deviceSession).values({
      deviceId: row.id,
      tokenHash: hashDeviceToken(token),
      expiresAt: deviceSessionExpiry(new Date()),
    });

    stubs.session = null;
    stubs.cookies = new Map([[DEVICE_SESSION_COOKIE, token]]);
    stubs.enqueued = [];
  });

  afterEach(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
  });

  afterAll(async () => {
    await pool.end();
  });

  /**
   * Stars the child can spend, credited by the seed rather than by an award —
   * awarding is exactly what a device may *not* do, so using the action here
   * would make the "may request a redemption" test depend on the thing the
   * next block proves is refused.
   */
  const creditStars = async (amount: number) => {
    await db.insert(starLedger).values({
      familyId: household.familyId,
      memberId: household.childId,
      amount,
      reason: 'manual',
    });
  };

  it('resolves the cookie to a device principal and nothing more', async () => {
    const { getPrincipal } = await import('@/modules/family/principal');
    expect(await getPrincipal()).toEqual({
      kind: 'device',
      familyId: household.familyId,
      deviceId,
    });
  });

  describe('may write', () => {
    it('completions', async () => {
      const [created] = await db
        .insert(routine)
        .values({
          familyId: household.familyId,
          ownerMemberId: household.childId,
          title: 'Ochtend',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
          starsPerCompletion: 1,
          createdAt: new Date(Date.now() - 30 * 86_400_000),
        })
        .returning();

      const [step] = await db
        .insert(schema.routineStep)
        .values({ routineId: created.id, title: 'Tanden poetsen', sortOrder: 0 })
        .returning();

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
        new Date()
      );
      const result = await completeStepAction({
        routineId: created.id,
        routineStepId: step.id,
        memberId: household.childId,
        occurrenceDate: today,
        clientId: `device-${step.id}-${today}`,
        source: 'hub',
      });

      expect(result.status).toBe('done');

      const rows = await db
        .select()
        .from(schema.completion)
        .where(eq(schema.completion.familyId, household.familyId));
      expect(rows).toHaveLength(1);
      // The row records the *surface*, not a member the kiosk invented: the
      // `completion` table has no actor column, and a device principal has no
      // member to borrow. The device shows up in the realtime actor instead.
      expect(rows[0].source).toBe('hub');
      expect(rows[0].memberId).toBe(household.childId);

      const [published] = await db
        .select()
        .from(schema.eventLog)
        .where(
          and(
            eq(schema.eventLog.familyId, household.familyId),
            eq(schema.eventLog.type, 'completion.created')
          )
        );
      expect(published.payload.actor.deviceId).toBe(deviceId);
      expect(published.payload.actor.memberId).toBeUndefined();
    });

    it('timers', async () => {
      const result = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        memberId: household.childId,
      });

      expect(result.status).toBe('started');
      expect(
        await db.select().from(timer).where(eq(timer.familyId, household.familyId))
      ).toHaveLength(1);
    });

    it('redemption requests', async () => {
      const [reward] = await db
        .insert(schema.reward)
        .values({
          familyId: household.familyId,
          title: 'Filmavond',
          costStars: 1,
          category: 'experience',
          icon: 'movie',
        })
        .returning();

      // Enough stars to afford it, credited by the seed rather than by an award
      // (which a device may not make — that is the next block).
      await creditStars(5);

      const result = await requestRedemptionAction({
        rewardId: reward.id,
        memberId: household.childId,
        clientId: `device-request-${reward.id}`,
      });

      expect(result.status).toBe('requested');
      expect(
        await db.select().from(redemption).where(eq(redemption.familyId, household.familyId))
      ).toHaveLength(1);
    });
  });

  describe('is rejected for', () => {
    it('settings — managing members', async () => {
      const result = await createMemberAction(
        { status: 'idle' },
        form({
          displayName: 'Nieuw kind',
          role: 'child',
          color: 'green',
          rewardHorizon: 'instant',
        })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      // Only the three seeded members remain: nothing was written.
      expect(
        await db.select().from(member).where(eq(member.familyId, household.familyId))
      ).toHaveLength(3);
    });

    it('settings — pairing another device', async () => {
      expect(await createPairingCodeAction({ deviceName: 'Hal', kind: 'hub' })).toEqual({
        status: 'error',
        error: 'forbidden',
      });

      expect(
        await db
          .select()
          .from(schema.devicePairingCode)
          .where(eq(schema.devicePairingCode.familyId, household.familyId))
      ).toEqual([]);
    });

    it('settings — the reward catalogue', async () => {
      const result = await createRewardAction(
        { status: 'idle' },
        form({ title: 'Nieuwe beloning', costStars: '3', category: 'experience', icon: 'movie' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(
        await db.select().from(schema.reward).where(eq(schema.reward.familyId, household.familyId))
      ).toEqual([]);
    });

    it('settings — routines', async () => {
      const result = await createRoutineAction(
        { status: 'idle' },
        form({
          ownerMemberId: household.childId,
          title: 'Avond',
          rrule: 'FREQ=DAILY',
          timeOfDay: '19:00',
          starsPerCompletion: '1',
        })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(
        await db.select().from(routine).where(eq(routine.familyId, household.familyId))
      ).toEqual([]);
    });

    it('calendar edits', async () => {
      const result = await createEventAction(
        { status: 'idle' },
        form({
          title: 'Tandarts',
          startsAt: '2026-04-02T09:00',
          endsAt: '2026-04-02T09:30',
          allDay: 'false',
          eventType: 'appointment',
        })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await db.select().from(event).where(eq(event.familyId, household.familyId))).toEqual(
        []
      );
    });

    it('star awards', async () => {
      const result = await awardStarsAction(
        { status: 'idle' },
        form({ memberId: household.childId, amount: '3', reason: 'manual' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      // The ledger is append-only, so "nothing was written" is the whole claim.
      expect(
        await db.select().from(starLedger).where(eq(starLedger.familyId, household.familyId))
      ).toEqual([]);
    });

    it('redemption approvals', async () => {
      const [reward] = await db
        .insert(schema.reward)
        .values({
          familyId: household.familyId,
          title: 'Filmavond',
          costStars: 1,
          category: 'experience',
          icon: 'movie',
        })
        .returning();

      await creditStars(5);

      const requested = await requestRedemptionAction({
        rewardId: reward.id,
        memberId: household.childId,
        clientId: `device-approval-${reward.id}`,
      });
      expect(requested.status).toBe('requested');

      const [pending] = await db
        .select()
        .from(redemption)
        .where(eq(redemption.familyId, household.familyId));

      // The same device that may *ask* may not *answer*. That asymmetry is the
      // entire §7 argument for a kiosk: a child standing at the wall must not
      // be able to approve their own request.
      const result = await decideRedemptionAction(
        { status: 'idle' },
        form({ redemptionId: pending.id, decision: 'approved' })
      );

      expect(result).toEqual({ status: 'error', error: 'forbidden' });

      const [after] = await db.select().from(redemption).where(eq(redemption.id, pending.id));
      expect(after.status).toBe('requested');
      expect(after.decidedAt).toBeNull();
    });
  });

  it('cannot reach another family with its own cookie', async () => {
    const other = await seedHousehold(db, 'Neighbours');

    const result = await startTimerAction({
      label: 'Vreemde timer',
      durationSeconds: 60,
      memberId: other.childId,
    });

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });
    expect(await db.select().from(timer).where(eq(timer.familyId, other.familyId))).toEqual([]);

    await db.delete(family).where(eq(family.id, other.familyId));
  });
});
