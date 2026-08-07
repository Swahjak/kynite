import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * PRD **FR22**, closed in M18: "Parents receive push notifications for
 * significant participant actions (e.g. routine complete)."
 *
 * This is Journey 1's payoff and it had never been implemented — the push
 * pipeline existed and fired only for reminders and redemption requests, so a
 * child tapping "done" on the hall tablet notified nobody. The three things
 * worth asserting are the three ways this feature goes wrong in a household:
 *
 *  - it does not fire at all (the M17 state);
 *  - it fires *again* on an offline-outbox replay, so a parent's phone buzzes
 *    twice for one tap;
 *  - it tells whoever just tapped what they themselves have done.
 *
 * Everything runs against a real Postgres; the only fakes are the queue and the
 * environment, exactly as `notification-preferences.test.ts` does it.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  enqueued: [] as { name: string; data: unknown }[],
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
// `@/modules/notifications`' barrel re-exports client components, which drag
// next-intl's client navigation into a plain Node run. The same seam every
// other integration suite in this directory uses.
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

const { listCompletionRecipients, notifyRoutineCompleted, upsertNotificationPreferences } =
  await import('@/modules/notifications');

vi.setConfig({ testTimeout: 30_000 });

describe.skipIf(!databaseUrl)('completion notifications — FR22 (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, member, pushSubscription } = schema;

  let household: Household;
  /** A second adult, so "every *other* adult" has something to be. */
  let otherAdultId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'CompletionPush');

    const [other] = await db
      .insert(member)
      .values({
        familyId: household.familyId,
        displayName: 'Jeroen',
        role: 'adult',
        color: 'blue',
        sortOrder: 4,
      })
      .returning();
    otherAdultId = other.id;
  });

  beforeEach(async () => {
    stubs.enqueued.length = 0;
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, household.familyId));
    await db
      .delete(schema.notificationPreference)
      .where(eq(schema.notificationPreference.familyId, household.familyId));
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  async function subscribe(memberId: string, endpoint: string): Promise<void> {
    await db.insert(pushSubscription).values({
      familyId: household.familyId,
      memberId,
      endpoint,
      p256dh: 'p256dh',
      auth: 'auth',
    });
  }

  const pushJobs = () => stubs.enqueued.filter((job) => job.name.startsWith('push'));

  const completion = (overrides: Partial<Parameters<typeof notifyRoutineCompleted>[0]> = {}) => ({
    familyId: household.familyId,
    memberName: 'Bram',
    stepTitle: 'Tanden poetsen',
    clientId: randomUUID(),
    ...overrides,
  });

  it('fans out to every adult when a child taps on the hub', async () => {
    await subscribe(household.parentId, 'https://push.example/parent');
    await subscribe(otherAdultId, 'https://push.example/other');

    // A hub tap has a *device* principal, so there is no adult to exclude —
    // which is precisely the case the feature exists for.
    const sent = await notifyRoutineCompleted(completion());

    expect(sent).toBe(2);
    expect(pushJobs()).toHaveLength(2);
  });

  it('never tells the adult who tapped what they just did', async () => {
    await subscribe(household.parentId, 'https://push.example/parent');
    await subscribe(otherAdultId, 'https://push.example/other');

    const sent = await notifyRoutineCompleted(completion({ actorMemberId: household.parentId }));

    expect(sent).toBe(1);
    expect(await listCompletionRecipients(household.familyId, household.parentId)).toEqual([
      otherAdultId,
    ]);
  });

  it('honours the per-member preference, and never routes to a child', async () => {
    await subscribe(household.parentId, 'https://push.example/parent');
    await subscribe(otherAdultId, 'https://push.example/other');
    await upsertNotificationPreferences({
      familyId: household.familyId,
      memberId: otherAdultId,
      preferences: {
        routineReminders: true,
        redemptionRequests: true,
        completionUpdates: false,
      },
    });

    expect(await listCompletionRecipients(household.familyId)).toEqual([household.parentId]);
    expect(await notifyRoutineCompleted(completion())).toBe(1);

    // A child has a member row and could have a preference row; neither makes
    // them a recipient.
    await upsertNotificationPreferences({
      familyId: household.familyId,
      memberId: household.childId,
      preferences: { routineReminders: true, redemptionRequests: true, completionUpdates: true },
    });
    expect(await listCompletionRecipients(household.familyId)).not.toContain(household.childId);
  });

  it('treats an absent preference row as "on", so the feature works for existing families', async () => {
    await subscribe(household.parentId, 'https://push.example/parent');

    expect(await listCompletionRecipients(household.familyId)).toContain(household.parentId);
    expect(await notifyRoutineCompleted(completion())).toBe(1);
  });

  it('carries the completion clientId as the notification tag, so a duplicate collapses', async () => {
    await subscribe(household.parentId, 'https://push.example/parent');

    const clientId = randomUUID();
    await notifyRoutineCompleted(completion({ clientId }));

    const [job] = pushJobs();
    const payload = (job.data as { payload: { tag: string; body: string } }).payload;

    expect(payload.tag).toBe(`completion:${clientId}`);
    // Neutral, factual, and about the child rather than to them (FR30).
    expect(payload.body).toContain('Bram');
    expect(payload.body).toContain('Tanden poetsen');
  });

  it('sends nothing when nobody has a live endpoint', async () => {
    expect(await notifyRoutineCompleted(completion())).toBe(0);
    expect(pushJobs()).toHaveLength(0);
  });
});
