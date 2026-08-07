import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * M16's criterion: **notification preferences are per adult member and are
 * honoured by `reminders:dispatch`.**
 *
 * The interesting failures are not "the checkbox did not save" — that is a
 * column. They are the three below, and each one is a household noticing
 * something wrong at 07:29 in the morning:
 *
 *  - a preference that is *stored* but not *read* by the job, so switching
 *    reminders off changes nothing;
 *  - a preference read for the wrong person, so one parent's choice silences
 *    the other's phone;
 *  - a suppressed reminder that nevertheless claims the idempotency key, so
 *    switching the setting back on produces silence for the rest of that day.
 *
 * The third is the one worth the extra assertion: the ledger row and the push
 * job have to be *both* absent, not just the push. Everything below runs
 * against a real Postgres; the only fakes are the queue and the environment.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  enqueued: [] as { name: string; data: unknown }[],
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
vi.mock('@/server/jobs/boss', () => ({
  enqueue: async (name: string, data: unknown) => {
    stubs.enqueued.push({ name, data });
    return randomUUID();
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.VAPID_PUBLIC_KEY ??= 'test-public-key';
process.env.VAPID_PRIVATE_KEY ??= 'test-private-key';
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

const {
  getNotificationPreferences,
  listRedemptionRecipients,
  notifyRedemptionRequested,
  runReminderDispatch,
  upsertNotificationPreferences,
  upsertPushSubscription,
} = await import('@/modules/notifications');

vi.setConfig({ testTimeout: 30_000 });

/** `07:30` Amsterdam on 10 March 2026 is `06:30Z`. */
const DUE_AT = new Date('2026-03-10T06:30:00Z');
const OCCURRENCE_DATE = '2026-03-10';

describe.skipIf(!databaseUrl)('notification preferences (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, member, notificationPreference, pushSubscription, reminderDispatch, routine } =
    schema;

  let household: Household;
  /** A second adult, so "per member" has something to be per. */
  let otherAdultId: string;
  let routineId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Preferences');

    const [adult] = await db
      .insert(member)
      .values({
        familyId: household.familyId,
        displayName: 'Mark',
        role: 'adult',
        color: 'blue',
        sortOrder: 3,
      })
      .returning({ id: member.id });
    otherAdultId = adult.id;

    // Owned by the *parent*, so the reminder under test lands on a member who
    // also has a preference row — a child owner would make the "per adult"
    // half of the criterion untestable.
    const [row] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        title: 'Tassen klaarzetten',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        createdAt: new Date('2026-01-01T06:00:00Z'),
      })
      .returning({ id: routine.id });
    routineId = row.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.enqueued.length = 0;
    await db.delete(reminderDispatch).where(eq(reminderDispatch.familyId, household.familyId));
    await db
      .delete(notificationPreference)
      .where(eq(notificationPreference.familyId, household.familyId));
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, household.familyId));
  });

  const pushJobs = () => stubs.enqueued.filter((job) => job.name === 'push.send');

  const ledger = () =>
    db.select().from(reminderDispatch).where(eq(reminderDispatch.familyId, household.familyId));

  const subscribe = (memberId: string, endpoint: string) =>
    upsertPushSubscription({
      familyId: household.familyId,
      memberId,
      endpoint,
      p256dh: 'p',
      auth: 'a',
    });

  const reminderJob = () => ({
    familyId: household.familyId,
    routineId,
    occurrenceDate: OCCURRENCE_DATE,
    memberId: household.parentId,
    dueAt: DUE_AT.toISOString(),
  });

  describe('the default', () => {
    it('treats a member with no row as wanting everything — nobody is silenced by a migration', async () => {
      expect(await getNotificationPreferences(household.familyId, household.parentId)).toEqual({
        routineReminders: true,
        redemptionRequests: true,
        completionUpdates: true,
      });

      await subscribe(household.parentId, 'https://push.example/parent');
      expect(await runReminderDispatch(reminderJob(), DUE_AT)).toBe(1);
    });
  });

  describe('routine reminders', () => {
    it('sends nothing — and claims nothing — when the owner switched them off', async () => {
      await subscribe(household.parentId, 'https://push.example/parent');
      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: household.parentId,
        preferences: { routineReminders: false, redemptionRequests: true, completionUpdates: true },
      });

      expect(await runReminderDispatch(reminderJob(), DUE_AT)).toBe(0);
      expect(pushJobs()).toHaveLength(0);
      // The key stays unclaimed on purpose: a preference is not an idempotency
      // decision, and burning the key here would silence the rest of the day
      // for a parent who changes their mind a minute later.
      expect(await ledger()).toHaveLength(0);
    });

    it('resumes the same day once the preference is switched back on', async () => {
      await subscribe(household.parentId, 'https://push.example/parent');
      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: household.parentId,
        preferences: { routineReminders: false, redemptionRequests: true, completionUpdates: true },
      });
      await runReminderDispatch(reminderJob(), DUE_AT);

      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: household.parentId,
        preferences: { routineReminders: true, redemptionRequests: true, completionUpdates: true },
      });

      expect(await runReminderDispatch(reminderJob(), DUE_AT)).toBe(1);
      expect(await ledger()).toHaveLength(1);
    });

    it('reads the preference of the routine owner, not of the other adult', async () => {
      await subscribe(household.parentId, 'https://push.example/parent');
      // The *other* adult switches reminders off. The routine is not theirs.
      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: otherAdultId,
        preferences: {
          routineReminders: false,
          redemptionRequests: false,
          completionUpdates: true,
        },
      });

      expect(await runReminderDispatch(reminderJob(), DUE_AT)).toBe(1);
    });
  });

  describe('redemption requests', () => {
    it('fans out to every adult who has not opted out', async () => {
      await subscribe(household.parentId, 'https://push.example/parent');
      await subscribe(otherAdultId, 'https://push.example/other');

      expect((await listRedemptionRecipients(household.familyId)).sort()).toEqual(
        [household.parentId, otherAdultId].sort()
      );

      const sent = await notifyRedemptionRequested({
        familyId: household.familyId,
        redemptionId: randomUUID(),
        childName: 'Bram',
        rewardTitle: 'Extra voorleesverhaal',
      });

      expect(sent).toBe(2);
    });

    it('skips the adult who switched them off and still reaches the other', async () => {
      await subscribe(household.parentId, 'https://push.example/parent');
      await subscribe(otherAdultId, 'https://push.example/other');
      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: otherAdultId,
        preferences: { routineReminders: true, redemptionRequests: false, completionUpdates: true },
      });

      expect(await listRedemptionRecipients(household.familyId)).toEqual([household.parentId]);

      const sent = await notifyRedemptionRequested({
        familyId: household.familyId,
        redemptionId: randomUUID(),
        childName: 'Bram',
        rewardTitle: 'Extra voorleesverhaal',
      });

      expect(sent).toBe(1);
      expect(
        pushJobs().map((job) => (job.data as { subscriptionId: string }).subscriptionId)
      ).toHaveLength(1);
    });

    it('never routes a request to a child, preference row or not', async () => {
      await upsertNotificationPreferences({
        familyId: household.familyId,
        memberId: household.childId,
        preferences: { routineReminders: true, redemptionRequests: true, completionUpdates: true },
      });

      expect(await listRedemptionRecipients(household.familyId)).not.toContain(household.childId);
    });
  });
});
