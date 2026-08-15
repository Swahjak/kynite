import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The nightly `maintenance:trim` job (docs/architecture.md §8; M10 review
 * carry-forward: "event_log retention trim job missing — `RETENTION_DAYS`
 * dead export").
 *
 * The trim is not housekeeping for its own sake. `event_log` is the SSE replay
 * buffer, and §4's `resync` branch — "a gap exceeding retention emits
 * `{type:'resync'}`" — is *unreachable* while nothing ever leaves the table:
 * a hub that was off for a fortnight would be handed a fortnight of events to
 * replay instead of being told to refetch. Trimming is what makes the
 * retention window real.
 *
 * The dangerous half is the timer trim, so it is the one with the most tests:
 * deleting a *running* timer would take a countdown off a wall mid-morning.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const {
  runMaintenanceTrim,
  REMINDER_LEDGER_RETENTION_DAYS,
  REVOKED_DEVICE_SESSION_RETENTION_DAYS,
  TIMER_RETENTION_DAYS,
} = await import('@/server/jobs/maintenance');
const { RETENTION_DAYS } = await import('@/modules/realtime');

vi.setConfig({ testTimeout: 30_000 });

const NOW = new Date('2026-03-10T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe.skipIf(!databaseUrl)('maintenance trim (integration)', () => {
  const { pool, db } = createTestDb();
  const {
    device,
    deviceSession,
    devicePairingAttempt,
    devicePairingCode,
    eventLog,
    family,
    pushSubscription,
    reminderDispatch,
    routine,
    timer,
  } = schema;

  let household: Household;
  let routineId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Trim');

    const [row] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.childId,
        title: 'Schoenen aan',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
      })
      .returning({ id: routine.id });
    routineId = row.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    await db.delete(eventLog).where(eq(eventLog.familyId, household.familyId));
    await db.delete(reminderDispatch).where(eq(reminderDispatch.familyId, household.familyId));
    await db.delete(timer).where(eq(timer.familyId, household.familyId));
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, household.familyId));
  });

  const logRows = () => db.select().from(eventLog).where(eq(eventLog.familyId, household.familyId));
  const timerRows = () => db.select().from(timer).where(eq(timer.familyId, household.familyId));

  async function seedEvent(createdAt: Date, label: string) {
    const [row] = await db
      .insert(eventLog)
      .values({
        familyId: household.familyId,
        type: 'completion.created',
        payload: {
          v: 1,
          id: '0',
          familyId: household.familyId,
          type: 'completion.created',
          at: createdAt.toISOString(),
          actor: { source: 'hub' },
          entity: { id: label },
        },
        createdAt,
      })
      .returning({ id: eventLog.id });
    return row.id;
  }

  it('drops event_log rows past the retention window and keeps the rest', async () => {
    await seedEvent(daysAgo(RETENTION_DAYS + 1), 'ancient');
    await seedEvent(daysAgo(RETENTION_DAYS - 1), 'recent');
    await seedEvent(daysAgo(0), 'now');

    const result = await runMaintenanceTrim(NOW);

    expect(result.eventLog).toBe(1);
    const remaining = await logRows();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((row) => row.payload.entity.id).sort()).toEqual(['now', 'recent']);
  });

  it('pins the window to the seven days §4 documents', async () => {
    expect(RETENTION_DAYS).toBe(7);

    // A row exactly at the boundary is kept: "older than seven days" is a
    // strict comparison, and a cursor from seven days ago must still replay.
    await seedEvent(new Date(NOW.getTime() - RETENTION_DAYS * 86_400_000 + 1000), 'boundary');
    await runMaintenanceTrim(NOW);
    expect(await logRows()).toHaveLength(1);
  });

  it('never deletes a running timer — it stops the abandoned ones instead', async () => {
    const startedAt = daysAgo(TIMER_RETENTION_DAYS + 30);
    await db.insert(timer).values({
      familyId: household.familyId,
      label: 'Ancient but running',
      durationSeconds: 300,
      startedAt,
      stoppedAt: null,
    });

    const result = await runMaintenanceTrim(NOW);

    // Not deleted, however old: the delete pass only ever sees finished rows,
    // and it runs before the stop pass precisely so a row that was running
    // when the job started survives the night.
    expect(result.timers).toBe(0);
    const [row] = await timerRows();
    expect(row.label).toBe('Ancient but running');

    // But it is no longer *running*: an abandoned row that the board stopped
    // showing a month ago would otherwise hold `timer_running_step_unique`
    // forever and block its step. The stamped end is the honest one — when the
    // countdown actually ran out, not tonight.
    expect(row.stoppedAt).not.toBeNull();
    expect(row.stoppedAt!.getTime()).toBe(startedAt.getTime() + 300_000);
  });

  it('leaves a running timer inside the board window completely alone', async () => {
    await db.insert(timer).values({
      familyId: household.familyId,
      label: 'Started an hour ago',
      durationSeconds: 300,
      startedAt: new Date(NOW.getTime() - 3_600_000),
      stoppedAt: null,
    });

    const result = await runMaintenanceTrim(NOW);

    expect(result.timers).toBe(0);
    const [row] = await timerRows();
    // Still on the wall, still running: the trim never touches a countdown a
    // household can currently see.
    expect(row.stoppedAt).toBeNull();
  });

  it('deletes finished timers past the window, and keeps recent ones', async () => {
    await db.insert(timer).values([
      {
        familyId: household.familyId,
        label: 'Old and finished',
        durationSeconds: 300,
        startedAt: daysAgo(TIMER_RETENTION_DAYS + 1),
        stoppedAt: daysAgo(TIMER_RETENTION_DAYS + 1),
      },
      {
        familyId: household.familyId,
        label: 'Yesterday',
        durationSeconds: 300,
        startedAt: daysAgo(1),
        stoppedAt: daysAgo(1),
      },
    ]);

    const result = await runMaintenanceTrim(NOW);

    expect(result.timers).toBe(1);
    const remaining = await timerRows();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].label).toBe('Yesterday');
  });

  it('prunes the reminder idempotency ledger once the occurrences are long past', async () => {
    await db.insert(reminderDispatch).values([
      {
        familyId: household.familyId,
        routineId,
        occurrenceDate: '2026-01-01',
        memberId: household.childId,
        createdAt: daysAgo(REMINDER_LEDGER_RETENTION_DAYS + 1),
      },
      {
        familyId: household.familyId,
        routineId,
        occurrenceDate: '2026-03-09',
        memberId: household.childId,
        createdAt: daysAgo(1),
      },
    ]);

    const result = await runMaintenanceTrim(NOW);

    expect(result.reminderDispatch).toBe(1);
    const remaining = await db
      .select()
      .from(reminderDispatch)
      .where(eq(reminderDispatch.familyId, household.familyId));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].occurrenceDate).toBe('2026-03-09');
  });

  describe('device sessions (M11 carry-forward: §8 named them, the table landed in M12)', () => {
    let deviceId: string;

    beforeEach(async () => {
      await db.delete(deviceSession);
      await db.delete(devicePairingCode);
      await db.delete(devicePairingAttempt);
      await db.delete(device).where(eq(device.familyId, household.familyId));

      const [row] = await db
        .insert(device)
        .values({ familyId: household.familyId, name: 'Keuken', kind: 'hub' })
        .returning({ id: device.id });
      deviceId = row.id;
    });

    const seedSession = async (input: { expiresAt: Date; revokedAt?: Date }) => {
      const [row] = await db
        .insert(deviceSession)
        .values({
          deviceId,
          tokenHash: `hash-${Math.random()}`,
          expiresAt: input.expiresAt,
          revokedAt: input.revokedAt ?? null,
        })
        .returning({ id: deviceSession.id });
      return row.id;
    };

    it('deletes expired sessions and keeps live ones', async () => {
      const live = await seedSession({ expiresAt: daysAgo(-300) });
      await seedSession({ expiresAt: daysAgo(1) });

      expect((await runMaintenanceTrim(NOW)).deviceSessions).toBe(1);

      const remaining = await db.select({ id: deviceSession.id }).from(deviceSession);
      expect(remaining.map((row) => row.id)).toEqual([live]);
    });

    it('keeps a freshly revoked session as evidence, and drops an old one', async () => {
      // "The tablet in the hall stopped working last Tuesday" has to stay
      // answerable; last spring does not.
      const recent = await seedSession({
        expiresAt: daysAgo(-300),
        revokedAt: daysAgo(1),
      });
      await seedSession({
        expiresAt: daysAgo(-300),
        revokedAt: daysAgo(REVOKED_DEVICE_SESSION_RETENTION_DAYS + 1),
      });

      expect((await runMaintenanceTrim(NOW)).deviceSessions).toBe(1);

      const remaining = await db.select({ id: deviceSession.id }).from(deviceSession);
      expect(remaining.map((row) => row.id)).toEqual([recent]);
    });

    it('prunes pairing codes past their TTL, consumed or not', async () => {
      await db.insert(devicePairingCode).values([
        {
          familyId: household.familyId,
          codeHash: `expired-${Math.random()}`,
          deviceName: 'Oud',
          kind: 'hub',
          expiresAt: daysAgo(1),
        },
        {
          familyId: household.familyId,
          codeHash: `live-${Math.random()}`,
          deviceName: 'Nieuw',
          kind: 'hub',
          expiresAt: daysAgo(-1),
        },
      ]);

      expect((await runMaintenanceTrim(NOW)).pairingCodes).toBe(1);

      const remaining = await db
        .select({ name: devicePairingCode.deviceName })
        .from(devicePairingCode);
      expect(remaining.map((row) => row.name)).toEqual(['Nieuw']);
    });

    it('prunes rate-limit counters outside the sliding window', async () => {
      await db.insert(devicePairingAttempt).values([
        { clientHash: 'a'.repeat(64), createdAt: daysAgo(1) },
        { clientHash: 'b'.repeat(64), createdAt: NOW },
      ]);

      // Review finding 9: `pairingAttempts` was computed by `trimDeviceSessions`
      // but dropped on the way into `TrimResult` — assert the number the job
      // actually reports, not just the row that survives.
      expect((await runMaintenanceTrim(NOW)).pairingAttempts).toBe(1);

      const remaining = await db
        .select({ hash: devicePairingAttempt.clientHash })
        .from(devicePairingAttempt);
      expect(remaining.map((row) => row.hash)).toEqual(['b'.repeat(64)]);
    });
  });

  it('is idempotent — a second pass the same night deletes nothing', async () => {
    await seedEvent(daysAgo(RETENTION_DAYS + 1), 'ancient');

    expect((await runMaintenanceTrim(NOW)).eventLog).toBe(1);
    expect((await runMaintenanceTrim(NOW)).eventLog).toBe(0);
  });
});
