import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { generateShareToken, hashShareToken } from '@/lib/share-token';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * Caregiver share links against a real database (M13).
 *
 * What this suite is for, over `tests/unit/share-credentials.test.ts`: the unit
 * tests prove the *primitives* are sound in isolation. These prove the
 * primitives are actually what the system uses — that the row a mint writes
 * holds no raw token, that a share principal resolved from a real token reaches
 * the §7 matrix cells it should and no others, and that expiry and revocation
 * are enforced at the resolver rather than only expressible in the schema.
 *
 * Every denial is asserted twice — the refusal *and* the absence of the row it
 * would have written. A refusal that still writes is the failure this exists
 * for; "it returned an error" alone would not catch it.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  cookies: new Map<string, string>(),
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
vi.mock('@/server/jobs/boss', () => ({ enqueue: async () => 'job-id' }));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

const { createShareLinkAction, revokeShareLinkAction } = await import('@/modules/sharing/actions');
const { resolveShareLink } = await import('@/modules/sharing/resolve');
const { listShareLinks } = await import('@/modules/sharing/queries');
const { recordCompletion } = await import('@/modules/routines/complete');

vi.setConfig({ testTimeout: 20_000 });

describe.skipIf(!databaseUrl)('caregiver share links (integration)', () => {
  const { pool, db } = createTestDb();
  const { completion, eventLog, family, routine, routineStep, shareLink, starLedger } = schema;

  let household: Household;
  let routineId: string;
  let stepId: string;
  let childRoutineId: string;
  let childStepId: string;

  beforeAll(() => {
    stubs.db = db;
  });

  beforeEach(async () => {
    household = await seedHousehold(db, 'Oppas');

    stubs.cookies = new Map();
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };

    // Two routines, one per child: the sibling's exists purely so the
    // out-of-scope denial has a real target rather than a random uuid.
    [{ id: routineId, stepId }, { id: childRoutineId, stepId: childStepId }] = [
      await seedRoutine(household.childId, 'Avondroutine'),
      await seedRoutine(household.siblingId, 'Ochtendroutine'),
    ];
  });

  afterEach(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    // `resolveShareLink` is `React.cache`d per request; in a test process there
    // is no request boundary, so the memo has to be dropped between cases or
    // the second resolution of a token would never re-read the row.
    vi.resetModules();
  });

  afterAll(async () => {
    await pool.end();
  });

  async function seedRoutine(memberId: string, title: string) {
    const [row] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: memberId,
        title,
        icon: 'star',
        // Every weekday, all day: the occurrence must be open whenever the
        // suite happens to run, or a completion test would fail on Sundays.
        schedule: {
          rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU',
          timeOfDay: '00:00',
          graceDays: 1,
        },
        starsPerCompletion: 2,
        rewardEnabled: true,
      })
      .returning();

    const [step] = await db
      .insert(routineStep)
      .values({ routineId: row.id, title: 'Tanden poetsen', sortOrder: 0 })
      .returning();

    return { id: row.id, stepId: step.id };
  }

  const mint = async (input: Parameters<typeof createShareLinkAction>[0]) => {
    const result = await createShareLinkAction(input);
    if (result.status !== 'created') throw new Error(`mint failed: ${JSON.stringify(result)}`);
    return result;
  };

  const todayKey = () => new Date().toISOString().slice(0, 10);

  describe('token hygiene', () => {
    it('stores the hash and nothing else — no column anywhere holds the raw token', async () => {
      const created = await mint({ role: 'viewer', label: 'Oma' });

      const [row] = await db
        .select()
        .from(shareLink)
        .where(eq(shareLink.tokenHash, hashShareToken(created.token)));

      expect(row).toBeDefined();
      expect(row.tokenHash).toBe(hashShareToken(created.token));

      // The strong form of the criterion: serialise the *entire row* and prove
      // the raw token appears nowhere in it — not in a stray column, not inside
      // the jsonb scope, not in the label. A `toBe` on one column would pass
      // even if a future migration added `token` next to `token_hash`.
      expect(JSON.stringify(row)).not.toContain(created.token);
    });

    it('never lands in the realtime event log either — NB-4', async () => {
      // The unit-shaped assertion above scans `share_link`; the raw token's
      // only *other* route into a durable column is via a publish this
      // credential itself triggers — resolving the link (which stamps
      // `lastUsedAt` through `recordShareUse`) and a contributor's completion
      // (which publishes `completion.created` / `stars.awarded` into
      // `event_log`, jsonb payload and all). Neither carries the link's
      // identity — `actorOf()` in `modules/routines/complete.ts` resolves a
      // share principal to `{}`, no link id, no token — but that is exactly
      // the property this test holds to the real write path rather than to
      // that function's implementation.
      const created = await mint({ role: 'contributor', memberIds: [household.childId] });

      const resolution = await resolveShareLink(created.token);
      if (resolution.status !== 'ok') throw new Error('expected an active link');

      const result = await recordCompletion(resolution.principal, {
        routineId,
        routineStepId: stepId,
        memberId: household.childId,
        occurrenceDate: todayKey(),
        clientId: `event-log-hygiene-${stepId}`,
        source: 'mobile',
      });
      expect(result.status).toBe('done');

      const rows = await db
        .select()
        .from(eventLog)
        .where(eq(eventLog.familyId, household.familyId));
      expect(rows.length).toBeGreaterThan(0);

      // Every text/jsonb column, serialised — a `toBe` on `payload` alone
      // would miss a future column that carried the token by accident.
      // `id` is `bigserial('id', { mode: 'bigint' })` (see
      // `modules/realtime/schema.ts`), so the replacer below is what makes
      // `JSON.stringify` possible at all here, not a hygiene nicety.
      const serializable = (_key: string, value: unknown) =>
        typeof value === 'bigint' ? value.toString() : value;
      for (const row of rows) {
        expect(JSON.stringify(row, serializable)).not.toContain(created.token);
      }
    });

    it('leaves the raw value unrecoverable — a full-table scan finds nothing', async () => {
      const created = await mint({ role: 'viewer' });

      const rows = await db.select().from(shareLink);
      expect(JSON.stringify(rows)).not.toContain(created.token);

      // And the read the settings page actually makes does not carry the hash
      // either: a column that never leaves the database cannot leak from a
      // server-component payload.
      const listed = await listShareLinks(household.familyId);
      expect(listed).toHaveLength(1);
      expect(JSON.stringify(listed)).not.toContain(created.token);
      expect(Object.keys(listed[0])).not.toContain('tokenHash');
    });

    it('mints a distinct token every time', async () => {
      const first = await mint({ role: 'viewer' });
      const second = await mint({ role: 'viewer' });

      expect(first.token).not.toBe(second.token);
      expect(first.url).toContain(first.token);
    });
  });

  describe('resolution', () => {
    it('yields a share principal with no cookie and no session row', async () => {
      const created = await mint({ role: 'viewer', memberIds: [household.childId] });

      const resolution = await resolveShareLink(created.token);

      expect(resolution.status).toBe('ok');
      if (resolution.status !== 'ok') return;
      expect(resolution.principal).toEqual({
        kind: 'share',
        familyId: household.familyId,
        role: 'viewer',
        scope: { memberIds: [household.childId] },
      });

      // The criterion, held structurally: resolving a link writes no session
      // and sets no cookie. There is no share session table to check — that is
      // the point — so what is checked is that nothing was set anywhere.
      expect([...stubs.cookies.keys()]).toEqual([]);
    });

    it('refuses a token that was never minted, without distinguishing it', async () => {
      expect(await resolveShareLink(generateShareToken())).toEqual({ status: 'notFound' });
      expect(await resolveShareLink('not-even-a-token')).toEqual({ status: 'notFound' });
    });

    it('refuses an expired link', async () => {
      const created = await mint({ role: 'viewer', expiresInDays: 1 });
      await db
        .update(shareLink)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(shareLink.tokenHash, hashShareToken(created.token)));

      expect(await resolveShareLink(created.token)).toEqual({ status: 'expired' });
    });

    it('refuses a revoked link on the very next request', async () => {
      const created = await mint({ role: 'contributor' });
      const [row] = await listShareLinks(household.familyId);

      expect(await revokeShareLinkAction({ id: row.id })).toEqual({ status: 'idle' });
      expect(await resolveShareLink(created.token)).toEqual({ status: 'revoked' });
    });

    it('never crosses a household boundary', async () => {
      const other = await seedHousehold(db, 'Buren');
      const created = await mint({ role: 'viewer' });

      const resolution = await resolveShareLink(created.token);
      expect(resolution.status).toBe('ok');
      if (resolution.status !== 'ok') return;
      expect(resolution.principal.familyId).toBe(household.familyId);
      expect(resolution.principal.familyId).not.toBe(other.familyId);

      await db.delete(family).where(eq(family.id, other.familyId));
    });
  });

  describe('usage telemetry', () => {
    it('stamps lastUsedAt and counts the first visit', async () => {
      const created = await mint({ role: 'viewer' });

      const before = await listShareLinks(household.familyId);
      expect(before[0].useCount).toBe(0);
      expect(before[0].lastUsedAt).toBeNull();

      await resolveShareLink(created.token);

      const after = await listShareLinks(household.familyId);
      expect(after[0].useCount).toBe(1);
      expect(after[0].lastUsedAt).not.toBeNull();
    });

    it('coalesces the requests inside one visit', async () => {
      const created = await mint({ role: 'viewer' });

      await resolveShareLink(created.token);
      // A fresh module graph, so the per-request `React.cache` memo is gone and
      // this is a genuinely second resolution — which must still not count as a
      // second visit, because a page load is many requests.
      vi.resetModules();
      const { resolveShareLink: resolveAgain } = await import('@/modules/sharing/resolve');
      await resolveAgain(created.token);

      const links = await listShareLinks(household.familyId);
      expect(links[0].useCount).toBe(1);
    });

    it('counts a return visit once the coalescing window has passed', async () => {
      const created = await mint({ role: 'viewer' });
      await resolveShareLink(created.token);

      await db
        .update(shareLink)
        .set({ lastUsedAt: new Date(Date.now() - 60 * 60 * 1000) })
        .where(eq(shareLink.tokenHash, hashShareToken(created.token)));

      vi.resetModules();
      const { resolveShareLink: resolveAgain } = await import('@/modules/sharing/resolve');
      await resolveAgain(created.token);

      const links = await listShareLinks(household.familyId);
      expect(links[0].useCount).toBe(2);
    });

    it('does not count a knock on a revoked link', async () => {
      const created = await mint({ role: 'viewer' });
      const [row] = await listShareLinks(household.familyId);
      await revokeShareLinkAction({ id: row.id });

      await resolveShareLink(created.token);

      const links = await listShareLinks(household.familyId);
      expect(links[0].useCount).toBe(0);
    });
  });

  describe('viewer links are strictly read-only', () => {
    it('refuses a completion, and writes nothing', async () => {
      const created = await mint({ role: 'viewer', memberIds: [household.childId] });
      const resolution = await resolveShareLink(created.token);
      if (resolution.status !== 'ok') throw new Error('expected an active link');

      const result = await recordCompletion(resolution.principal, {
        routineId,
        routineStepId: stepId,
        memberId: household.childId,
        occurrenceDate: todayKey(),
        clientId: `viewer-${stepId}`,
        source: 'mobile',
      });

      expect(result).toEqual({ status: 'error', error: 'forbidden' });

      const rows = await db
        .select()
        .from(completion)
        .where(eq(completion.familyId, household.familyId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('contributor links may tick, inside scope only', () => {
    it('completes a step for a member inside scope, and pays the star', async () => {
      const created = await mint({ role: 'contributor', memberIds: [household.childId] });
      const resolution = await resolveShareLink(created.token);
      if (resolution.status !== 'ok') throw new Error('expected an active link');

      const result = await recordCompletion(resolution.principal, {
        routineId,
        routineStepId: stepId,
        memberId: household.childId,
        occurrenceDate: todayKey(),
        clientId: `contrib-${stepId}`,
        source: 'mobile',
      });

      expect(result).toEqual({ status: 'done', stars: 2, replayed: false });

      const rows = await db
        .select()
        .from(completion)
        .where(eq(completion.memberId, household.childId));
      expect(rows).toHaveLength(1);

      const ledger = await db
        .select()
        .from(starLedger)
        .where(eq(starLedger.memberId, household.childId));
      expect(ledger).toHaveLength(1);
      expect(ledger[0].amount).toBe(2);
    });

    it('refuses a member outside scope, and writes nothing', async () => {
      const created = await mint({ role: 'contributor', memberIds: [household.childId] });
      const resolution = await resolveShareLink(created.token);
      if (resolution.status !== 'ok') throw new Error('expected an active link');

      // The sibling is a real member of the same family with a real routine —
      // everything is valid except that this link was not minted for them.
      const result = await recordCompletion(resolution.principal, {
        routineId: childRoutineId,
        routineStepId: childStepId,
        memberId: household.siblingId,
        occurrenceDate: todayKey(),
        clientId: `out-of-scope-${childStepId}`,
        source: 'mobile',
      });

      expect(result).toEqual({ status: 'error', error: 'forbidden' });

      const rows = await db
        .select()
        .from(completion)
        .where(eq(completion.memberId, household.siblingId));
      expect(rows).toHaveLength(0);
      const ledger = await db
        .select()
        .from(starLedger)
        .where(eq(starLedger.memberId, household.siblingId));
      expect(ledger).toHaveLength(0);
    });

    it('an unscoped contributor link covers every member', async () => {
      const created = await mint({ role: 'contributor' });
      const resolution = await resolveShareLink(created.token);
      if (resolution.status !== 'ok') throw new Error('expected an active link');

      const result = await recordCompletion(resolution.principal, {
        routineId: childRoutineId,
        routineStepId: childStepId,
        memberId: household.siblingId,
        occurrenceDate: todayKey(),
        clientId: `unscoped-${childStepId}`,
        source: 'mobile',
      });

      expect(result.status).toBe('done');
    });

    it('cannot tick after the link is revoked — there is nothing left to resolve', async () => {
      const created = await mint({ role: 'contributor', memberIds: [household.childId] });
      const [row] = await listShareLinks(household.familyId);
      await revokeShareLinkAction({ id: row.id });

      expect(await resolveShareLink(created.token)).toEqual({ status: 'revoked' });

      const rows = await db
        .select()
        .from(completion)
        .where(eq(completion.familyId, household.familyId));
      expect(rows).toHaveLength(0);
    });
  });

  describe('management is owner/adult only', () => {
    it('refuses a mint with no principal', async () => {
      stubs.session = null;
      expect(await createShareLinkAction({ role: 'viewer' })).toEqual({
        status: 'error',
        error: 'forbidden',
      });
      expect(await listShareLinks(household.familyId)).toHaveLength(0);
    });

    it('refuses a mint from a child member', async () => {
      stubs.session = {
        session: { activeFamilyId: household.familyId, memberId: household.childId },
      };
      expect(await createShareLinkAction({ role: 'contributor' })).toEqual({
        status: 'error',
        error: 'forbidden',
      });
      expect(await listShareLinks(household.familyId)).toHaveLength(0);
    });

    it('refuses to revoke another family’s link', async () => {
      const created = await mint({ role: 'viewer' });
      const [row] = await listShareLinks(household.familyId);

      const other = await seedHousehold(db, 'Buren');
      stubs.session = { session: { activeFamilyId: other.familyId, memberId: other.parentId } };

      expect(await revokeShareLinkAction({ id: row.id })).toEqual({
        status: 'error',
        error: 'shareLinkNotFound',
      });

      // Still resolvable: the refusal did not half-revoke it.
      stubs.session = {
        session: { activeFamilyId: household.familyId, memberId: household.parentId },
      };
      expect((await resolveShareLink(created.token)).status).toBe('ok');

      await db.delete(family).where(eq(family.id, other.familyId));
    });
  });
});
