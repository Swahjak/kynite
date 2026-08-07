import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The push subscription lifecycle, running for real (M11).
 *
 * `tests/unit/notifications/delivery.test.ts` proves the *policy* is a correct
 * truth table. What it cannot prove is that the policy is actually applied to
 * a row: that a re-subscribe upserts onto the same endpoint instead of
 * duplicating a phone, that a `410` really deletes, that three consecutive
 * `500`s really disable, and — the criterion that matters most on a bad night
 * — that one dead device does not stop the household's other devices from
 * being notified.
 *
 * Nothing here touches a push service: `runPushSend` takes its transport as a
 * parameter, so "the endpoint returns 410" is a two-line fake.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  enqueued: [] as { name: string; data: unknown; options: unknown }[],
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
// The family barrel reaches next-intl's client navigation, which cannot
// resolve outside a bundler. Same stub every integration suite in this repo
// carries (see `tests/integration/timer.test.ts`).
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));
// The queue boundary, captured rather than driven: what this suite asserts is
// the *shape* of the fan-out (one job per endpoint), not pg-boss's behaviour.
vi.mock('@/server/jobs/boss', () => ({
  enqueue: async (name: string, data: unknown, options: unknown) => {
    stubs.enqueued.push({ name, data, options });
    return randomUUID();
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
// Push has to look configured or every entry point short-circuits. The keys
// are never used: the transport is faked below.
process.env.VAPID_PUBLIC_KEY ??= 'test-public-key';
process.env.VAPID_PRIVATE_KEY ??= 'test-private-key';

const {
  applyDeliveryOutcome,
  fanOutPush,
  listActiveSubscriptions,
  runPushSend,
  upsertPushSubscription,
} = await import('@/modules/notifications');
const { POST, DELETE } = await import('@/app/api/push/subscribe/route');

vi.setConfig({ testTimeout: 20_000 });

const PAYLOAD = {
  title: 'Tanden poetsen',
  body: 'Tanden poetsen over 5 minuten',
  url: '/nl/routines',
  tag: 'reminder:r:2026-03-10:m',
};

function subscribeRequest(endpoint: string) {
  return new Request('http://localhost/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'Vitest/1.0' },
    body: JSON.stringify({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
  });
}

describe.skipIf(!databaseUrl)('push subscriptions (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, pushSubscription } = schema;

  let household: Household;
  let other: Household;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Push');
    other = await seedHousehold(db, 'Push elders');
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await db.delete(family).where(eq(family.id, other.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    stubs.enqueued.length = 0;
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, household.familyId));
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, other.familyId));
  });

  const rowsOf = (familyId: string) =>
    db.select().from(pushSubscription).where(eq(pushSubscription.familyId, familyId));

  describe('POST /api/push/subscribe', () => {
    it('stores the endpoint for the signed-in member', async () => {
      const response = await POST(subscribeRequest('https://push.example/endpoint-1'));
      expect(response.status).toBe(200);

      const [row] = await rowsOf(household.familyId);
      expect(row.endpoint).toBe('https://push.example/endpoint-1');
      expect(row.memberId).toBe(household.parentId);
      expect(row.p256dh).toBe('p256dh-value');
      expect(row.userAgent).toBe('Vitest/1.0');
      expect(row.failureCount).toBe(0);
      expect(row.disabledAt).toBeNull();
    });

    it('upserts by endpoint — one row per device, not one per subscribe', async () => {
      await POST(subscribeRequest('https://push.example/endpoint-1'));
      await POST(subscribeRequest('https://push.example/endpoint-1'));
      await POST(subscribeRequest('https://push.example/endpoint-1'));

      expect(await rowsOf(household.familyId)).toHaveLength(1);
    });

    it('re-points an endpoint at whoever is signed in on it now', async () => {
      await POST(subscribeRequest('https://push.example/shared-tablet'));

      // A second parent signs in on the same browser.
      stubs.session = {
        session: { activeFamilyId: household.familyId, memberId: household.childId },
      };
      await POST(subscribeRequest('https://push.example/shared-tablet'));

      const rows = await rowsOf(household.familyId);
      expect(rows).toHaveLength(1);
      expect(rows[0].memberId).toBe(household.childId);
    });

    it('revives a disabled subscription — asking again means the device is reachable', async () => {
      await POST(subscribeRequest('https://push.example/flaky'));
      const [before] = await rowsOf(household.familyId);

      await db
        .update(pushSubscription)
        .set({ failureCount: 3, disabledAt: new Date() })
        .where(eq(pushSubscription.id, before.id));

      await POST(subscribeRequest('https://push.example/flaky'));

      const [after] = await rowsOf(household.familyId);
      expect(after.id).toBe(before.id);
      expect(after.failureCount).toBe(0);
      expect(after.disabledAt).toBeNull();
    });

    it('refuses a request with no session', async () => {
      stubs.session = null;
      const response = await POST(subscribeRequest('https://push.example/anon'));

      expect(response.status).toBe(401);
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    it('refuses a malformed subscription', async () => {
      const response = await POST(
        new Request('http://localhost/api/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: 'not-a-url' }),
        })
      );

      expect(response.status).toBe(400);
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    /**
     * The endpoint is a capability URL, and a leaked one must buy nothing
     * beyond what holding it already buys. Before this, a member of family A
     * could post family B's endpoint and the upsert would re-point the row —
     * family, member and keys — at A: B's device would silently start
     * receiving A's reminders, and B would stop receiving its own.
     */
    it('refuses to take over an endpoint that belongs to another household', async () => {
      const [neighbour] = await db
        .insert(pushSubscription)
        .values({
          familyId: other.familyId,
          memberId: other.parentId,
          endpoint: 'https://push.example/neighbour-tablet',
          p256dh: 'neighbour-p256dh',
          auth: 'neighbour-auth',
        })
        .returning();

      // The signed-in principal is family A's parent (the `beforeEach` stub).
      const response = await POST(subscribeRequest('https://push.example/neighbour-tablet'));

      // A generic failure, not a "that one is taken" — the route is not an
      // oracle for which endpoints exist.
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalidSubscription' });

      // Nothing was created for the caller...
      expect(await rowsOf(household.familyId)).toHaveLength(0);
      // ...and B's row is byte-for-byte what it was.
      const [after] = await rowsOf(other.familyId);
      expect(after.id).toBe(neighbour.id);
      expect(after.familyId).toBe(other.familyId);
      expect(after.memberId).toBe(other.parentId);
      expect(after.p256dh).toBe('neighbour-p256dh');
      expect(after.auth).toBe('neighbour-auth');
      expect(after.updatedAt.getTime()).toBe(neighbour.updatedAt.getTime());
    });
  });

  describe('DELETE /api/push/subscribe', () => {
    it('removes this household’s row for the endpoint', async () => {
      await POST(subscribeRequest('https://push.example/going-away'));

      const response = await DELETE(
        new Request('http://localhost/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: 'https://push.example/going-away' }),
        })
      );

      expect(response.status).toBe(200);
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    it('cannot delete another household’s endpoint', async () => {
      await upsertPushSubscription({
        familyId: other.familyId,
        memberId: other.parentId,
        endpoint: 'https://push.example/neighbour',
        p256dh: 'p',
        auth: 'a',
      });

      await DELETE(
        new Request('http://localhost/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: 'https://push.example/neighbour' }),
        })
      );

      expect(await rowsOf(other.familyId)).toHaveLength(1);
    });
  });

  describe('delivery outcomes applied to the row', () => {
    const seed = async (endpoint: string) =>
      upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.parentId,
        endpoint,
        p256dh: 'p',
        auth: 'a',
      });

    it.each([404, 410])('deletes the subscription on a %i', async (status) => {
      const row = await seed(`https://push.example/gone-${status}`);

      const outcome = await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => ({
        statusCode: status,
      }));

      expect(outcome).toBe('failed');
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    it('disables after exactly three consecutive failures, and not before', async () => {
      const row = await seed('https://push.example/flaky-endpoint');
      const failing = async () => ({ statusCode: 500 });

      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, failing);
      let [current] = await rowsOf(household.familyId);
      expect(current.failureCount).toBe(1);
      expect(current.disabledAt).toBeNull();

      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, failing);
      [current] = await rowsOf(household.familyId);
      expect(current.failureCount).toBe(2);
      expect(current.disabledAt).toBeNull();

      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, failing);
      [current] = await rowsOf(household.familyId);
      expect(current.failureCount).toBe(3);
      expect(current.disabledAt).not.toBeNull();
      // Disabled, never deleted — the row has to survive for a re-subscribe.
      expect(await rowsOf(household.familyId)).toHaveLength(1);
    });

    it('a success in the middle resets the run', async () => {
      const row = await seed('https://push.example/recovering');

      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => ({
        statusCode: 500,
      }));
      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => ({
        statusCode: 500,
      }));
      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => ({
        statusCode: 201,
      }));

      const [current] = await rowsOf(household.familyId);
      expect(current.failureCount).toBe(0);
      expect(current.lastSuccessAt).not.toBeNull();

      // …so the next failure is the first of a new run, not the third of an old one.
      await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => ({
        statusCode: 500,
      }));
      const [after] = await rowsOf(household.familyId);
      expect(after.disabledAt).toBeNull();
    });

    it('skips a disabled subscription without touching the transport', async () => {
      const row = await seed('https://push.example/disabled');
      await db
        .update(pushSubscription)
        .set({ disabledAt: new Date(), failureCount: 3 })
        .where(eq(pushSubscription.id, row.id));

      let called = 0;
      const outcome = await runPushSend({ subscriptionId: row.id, payload: PAYLOAD }, async () => {
        called += 1;
        return { statusCode: 201 };
      });

      expect(outcome).toBe('skipped');
      expect(called).toBe(0);
    });

    it('reports a missing row rather than throwing', async () => {
      expect(await applyDeliveryOutcome(randomUUID(), 'success')).toBe('missing');
    });
  });

  describe('fan-out', () => {
    it('enqueues one push:send job per endpoint, not one per notification', async () => {
      // Two parents, three devices between them.
      for (const endpoint of ['phone-a', 'tablet-a']) {
        await upsertPushSubscription({
          familyId: household.familyId,
          memberId: household.parentId,
          endpoint: `https://push.example/${endpoint}`,
          p256dh: 'p',
          auth: 'a',
        });
      }
      await upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.childId,
        endpoint: 'https://push.example/phone-b',
        p256dh: 'p',
        auth: 'a',
      });

      const sent = await fanOutPush(
        household.familyId,
        [household.parentId, household.childId],
        PAYLOAD
      );

      expect(sent).toBe(3);
      expect(stubs.enqueued).toHaveLength(3);
      // The dot form: pg-boss 12 forbids `:` in a queue name (§8).
      expect(new Set(stubs.enqueued.map((job) => job.name))).toEqual(new Set(['push.send']));

      // One singleton key per *device*, which is what stops a dead phone from
      // serialising behind — or blocking — anyone else's.
      const keys = stubs.enqueued.map(
        (job) => (job.options as { singletonKey: string }).singletonKey
      );
      expect(new Set(keys).size).toBe(3);
    });

    it('never fans out to a disabled endpoint', async () => {
      const live = await upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.parentId,
        endpoint: 'https://push.example/live',
        p256dh: 'p',
        auth: 'a',
      });
      const dead = await upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.parentId,
        endpoint: 'https://push.example/dead',
        p256dh: 'p',
        auth: 'a',
      });
      await db
        .update(pushSubscription)
        .set({ disabledAt: new Date() })
        .where(eq(pushSubscription.id, dead.id));

      const active = await listActiveSubscriptions(household.familyId, [household.parentId]);
      expect(active.map((row) => row.id)).toEqual([live.id]);

      expect(await fanOutPush(household.familyId, [household.parentId], PAYLOAD)).toBe(1);
    });

    it('never crosses a family boundary', async () => {
      await upsertPushSubscription({
        familyId: other.familyId,
        memberId: other.parentId,
        endpoint: 'https://push.example/neighbour-phone',
        p256dh: 'p',
        auth: 'a',
      });

      // Asking for the neighbour's member id inside *our* family returns
      // nothing: the predicate carries both.
      expect(await listActiveSubscriptions(household.familyId, [other.parentId])).toHaveLength(0);
      expect(await fanOutPush(household.familyId, [other.parentId], PAYLOAD)).toBe(0);
      expect(stubs.enqueued).toHaveLength(0);
    });
  });
});
