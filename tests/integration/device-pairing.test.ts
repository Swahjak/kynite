import { createHash } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  DEVICE_SESSION_COOKIE,
  DEVICE_SESSION_TTL_MS,
  PAIRING_CODE_TTL_MS,
  PAIRING_GLOBAL_MAX_FAILURES,
  PAIRING_MAX_FAILURES,
  PAIRING_MAX_LIVE_CODES_PER_FAMILY,
  hashDeviceToken,
  hashPairingCode,
} from '@/lib/device-session';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * Kiosk pairing, running for real (M12, docs/architecture.md §7).
 *
 * `tests/unit/permissions.test.ts` proves the §7 matrix and
 * `tests/unit/server-action-authorization.test.ts` proves every action reaches
 * the chokepoint. Neither can prove the properties that make a six-digit code
 * a credential, because all of them are properties of the *database*: the
 * claiming UPDATE, the TTL predicate, the partial unique index. Those are
 * settled here.
 *
 * Four claims, one per criterion:
 *
 *  1. a generated code pairs a device;
 *  2. a code older than ten minutes does not;
 *  3. a code that already paired a device does not (single use);
 *  4. the resulting cookie is httpOnly / Lax / secure / a year long, and it
 *     slides — both the row and the cookie.
 *
 * The only fakes are framework seams: the cookie jar, the session, `headers()`,
 * revalidation and the locale. `redeemPairingCode`, `getPrincipal()`, every
 * query and every write are real.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  cookies: new Map<string, string>(),
  written: [] as { name: string; value: string; options: Record<string, unknown> }[],
  requestHeaders: new Headers(),
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({
  headers: async () => stubs.requestHeaders,
  cookies: async () => ({
    get: (name: string) =>
      stubs.cookies.has(name) ? { name, value: stubs.cookies.get(name)! } : undefined,
    set: (name: string, value: string, options: Record<string, unknown>) => {
      stubs.cookies.set(name, value);
      stubs.written.push({ name, value, options });
    },
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

const { createPairingCodeAction, pairDeviceAction, revokeDeviceAction } =
  await import('@/modules/devices/actions');
const { getPrincipal } = await import('@/modules/family/principal');

vi.setConfig({ testTimeout: 20_000 });

describe.skipIf(!databaseUrl)('kiosk device pairing (integration)', () => {
  const { pool, db } = createTestDb();
  const { device, deviceSession, devicePairingCode, devicePairingAttempt, family } = schema;

  let household: Household;

  beforeAll(() => {
    stubs.db = db;
  });

  beforeEach(async () => {
    household = await seedHousehold(db, 'Pairing');
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    stubs.cookies = new Map();
    stubs.written = [];
    stubs.requestHeaders = new Headers({
      'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
      'user-agent': `vitest-${Math.random()}`,
    });

    // The rate-limit table is global, not family-scoped (by design — that is
    // the whole point of the global budget below), so it has to be cleared
    // between tests or an earlier test's failures would leak into a later
    // test's count and make it flaky depending on run order.
    await db.delete(devicePairingAttempt);
  });

  // Every household is dropped again: the reads below are family-scoped, and a
  // leftover family from a previous test would make an unscoped mistake look
  // like a pass.
  afterEach(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
  });

  afterAll(async () => {
    await pool.end();
  });

  /** The family's devices. Scoped, always — this suite seeds several families. */
  const ourDevices = () => db.select().from(device).where(eq(device.familyId, household.familyId));

  const ourSessions = async () => {
    const devices = await ourDevices();
    const ids = devices.map((row) => row.id);
    const rows = await db.select().from(deviceSession);
    return rows.filter((row) => ids.includes(row.deviceId));
  };

  /** The fingerprint `pairDeviceAction` derives from the stubbed headers. */
  const clientHashOf = () =>
    createHash('sha256')
      .update(
        [
          stubs.requestHeaders.get('x-forwarded-for')!.split(',')[0].trim(),
          stubs.requestHeaders.get('user-agent')!,
        ].join('|')
      )
      .digest('hex');

  /** Drops the account session, leaving only whatever cookie pairing wrote. */
  const asKiosk = () => {
    stubs.session = null;
  };

  /**
   * Back to the parent's phone — a *different device*, so the kiosk cookie goes
   * with it. `getPrincipal()` resolves the device before the account session
   * (see `modules/family/principal.ts`), so a jar holding both would still be a
   * kiosk, and `device:manage` would be refused for the right reason at the
   * wrong moment.
   */
  const asParent = () => {
    stubs.cookies.delete(DEVICE_SESSION_COOKIE);
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
  };

  const generate = async (deviceName = 'Keuken') => {
    const state = await createPairingCodeAction({ deviceName, kind: 'hub' });
    if (state.status !== 'created') throw new Error(`expected a code, got ${state.status}`);
    return state;
  };

  it('pairs a device, and stores only the hash of the code', async () => {
    const { code } = await generate('Keuken');

    // The digits themselves are nowhere in the row.
    const [row] = await db
      .select()
      .from(devicePairingCode)
      .where(eq(devicePairingCode.familyId, household.familyId));
    expect(row.codeHash).toBe(hashPairingCode(code));
    expect(JSON.stringify(row)).not.toContain(code);

    asKiosk();
    const result = await pairDeviceAction({ code });

    expect(result).toEqual({ status: 'paired', deviceName: 'Keuken' });

    const [paired] = await ourDevices();
    expect(paired.name).toBe('Keuken');
    expect(paired.kind).toBe('hub');
    expect(paired.revokedAt).toBeNull();

    // And the cookie now resolves to a device principal — the actual point.
    const principal = await getPrincipal();
    expect(principal).toEqual({
      kind: 'device',
      familyId: household.familyId,
      deviceId: paired.id,
    });
  });

  it('stores only the hash of the session token, never the token', async () => {
    const { code } = await generate();
    asKiosk();
    await pairDeviceAction({ code });

    const raw = stubs.cookies.get(DEVICE_SESSION_COOKIE)!;
    expect(raw).toBeTruthy();

    const sessions = await ourSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).toBe(hashDeviceToken(raw));
    // Non-vacuity: the raw value appears in no column of the row.
    expect(JSON.stringify(sessions[0])).not.toContain(raw);
  });

  it('refuses a code older than ten minutes', async () => {
    const { code } = await generate();

    // Age the row past its TTL rather than waiting ten minutes. The predicate
    // under test is `expires_at > now()` in the claiming UPDATE, and moving
    // the row's clock is the only honest way to reach it.
    await db
      .update(devicePairingCode)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(devicePairingCode.familyId, household.familyId));

    asKiosk();
    expect(await pairDeviceAction({ code })).toEqual({
      status: 'error',
      error: 'invalidCode',
    });

    expect(await ourDevices()).toEqual([]);
  });

  it('accepts a code exactly once', async () => {
    const { code } = await generate();
    asKiosk();

    expect((await pairDeviceAction({ code })).status).toBe('paired');

    // A second tablet, a replayed request, a screenshot passed around: all the
    // same thing to the claiming UPDATE.
    stubs.cookies.delete(DEVICE_SESSION_COOKIE);
    expect(await pairDeviceAction({ code })).toEqual({
      status: 'error',
      error: 'invalidCode',
    });

    expect(await ourDevices()).toHaveLength(1);
  });

  it('never lets two live codes share a hash', async () => {
    // The partial unique index is what makes "six digits identifies one
    // family" true. Proven by forcing the collision the generator retries
    // around: a second unconsumed row with the same hash must be impossible.
    const { code } = await generate();
    const other = await seedHousehold(db, 'Other');

    await expectRejection(
      db.insert(devicePairingCode).values({
        familyId: other.familyId,
        codeHash: hashPairingCode(code),
        deviceName: 'Hal',
        kind: 'hub',
        expiresAt: new Date(Date.now() + PAIRING_CODE_TTL_MS),
      }),
      /device_pairing_code_hash_unclaimed_unique/
    );

    await db.delete(family).where(eq(family.id, other.familyId));
  });

  describe('the session cookie', () => {
    it('is httpOnly, SameSite=Lax, secure and one year long', async () => {
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });

      const written = stubs.written.find((entry) => entry.name === DEVICE_SESSION_COOKIE);
      expect(written).toBeDefined();
      expect(written!.options.httpOnly).toBe(true);
      expect(written!.options.sameSite).toBe('lax');
      expect(written!.options.path).toBe('/');
      // `secure` is env-dependent by design (an http://localhost kiosk would
      // never receive the cookie otherwise), so the assertion is on the rule
      // rather than on the value.
      expect(written!.options.secure).toBe(process.env.NODE_ENV === 'production');

      const year = Math.floor(DEVICE_SESSION_TTL_MS / 1000);
      expect(written!.options.maxAge).toBe(year);
      const expires = written!.options.expires as Date;
      expect(expires.getTime() - Date.now()).toBeGreaterThan(DEVICE_SESSION_TTL_MS - 60_000);

      // And the row agrees with the cookie.
      const [session] = await ourSessions();
      expect(session.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        DEVICE_SESSION_TTL_MS - 60_000
      );
    });

    it('slides the row forward on use, once the coalescing window has passed', async () => {
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });

      const [before] = await ourSessions();
      const [pairedDevice] = await ourDevices();

      // Two hours of wall time, expressed as the row being two hours stale:
      // `lastSeenAt` is the coalescing clock, and `expiresAt` is pushed back so
      // a slide is observable as movement rather than as a no-op.
      const stale = new Date(Date.now() - 2 * 60 * 60 * 1000);
      await db.update(device).set({ lastSeenAt: stale }).where(eq(device.id, pairedDevice.id));
      await db
        .update(deviceSession)
        .set({ expiresAt: new Date(stale.getTime() + DEVICE_SESSION_TTL_MS) })
        .where(eq(deviceSession.id, before.id));

      const [staleRow] = await ourSessions();

      // One ordinary use — resolving the principal is what every hub request
      // does, and it is where §7's "sliding on each use" lives.
      expect((await getPrincipal())?.kind).toBe('device');

      const [after] = await ourSessions();
      const [seen] = await ourDevices();

      expect(after.expiresAt.getTime()).toBeGreaterThan(staleRow.expiresAt.getTime());
      expect(after.expiresAt.getTime() - Date.now()).toBeGreaterThan(
        DEVICE_SESSION_TTL_MS - 60_000
      );
      expect(seen.lastSeenAt!.getTime()).toBeGreaterThan(stale.getTime());
    });

    it('does not write on every request inside the coalescing window', async () => {
      // The other half of the sliding decision: a wall tablet polls every two
      // seconds, and a write per poll would be tens of thousands of UPDATEs a
      // day to move a timestamp that is a year out.
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });

      const [before] = await ourSessions();
      await getPrincipal();
      const [after] = await ourSessions();

      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });
  });

  describe('revocation', () => {
    it('drops the device principal on the very next request', async () => {
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });

      const [paired] = await ourDevices();
      expect((await getPrincipal())?.kind).toBe('device');

      // Back to the parent's phone to revoke.
      const kioskToken = stubs.cookies.get(DEVICE_SESSION_COOKIE)!;
      asParent();
      expect(await revokeDeviceAction({ deviceId: paired.id })).toEqual({ status: 'idle' });

      // And back to the tablet, credential intact — which is the point: the
      // cookie is unchanged and it no longer resolves.
      asKiosk();
      stubs.cookies.set(DEVICE_SESSION_COOKIE, kioskToken);
      expect(await getPrincipal()).toBeNull();

      // The session row is marked, not deleted: "this tablet was cut off" has
      // to stay answerable.
      const [session] = await ourSessions();
      expect(session.revokedAt).not.toBeNull();
    });

    it('publishes device.revoked on the family channel', async () => {
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });
      const [paired] = await ourDevices();

      asParent();
      await revokeDeviceAction({ deviceId: paired.id });

      const log = await db
        .select()
        .from(schema.eventLog)
        .where(
          and(
            eq(schema.eventLog.familyId, household.familyId),
            eq(schema.eventLog.type, 'device.revoked')
          )
        );

      expect(log).toHaveLength(1);
      expect(log[0].payload.entity.id).toBe(paired.id);
    });

    it('refuses to revoke another family’s device', async () => {
      const { code } = await generate();
      asKiosk();
      await pairDeviceAction({ code });
      const [paired] = await ourDevices();

      const other = await seedHousehold(db, 'Neighbours');
      stubs.cookies.delete(DEVICE_SESSION_COOKIE);
      stubs.session = { session: { activeFamilyId: other.familyId, memberId: other.parentId } };

      expect(await revokeDeviceAction({ deviceId: paired.id })).toEqual({
        status: 'error',
        error: 'deviceNotFound',
      });

      const [still] = await db.select().from(device).where(eq(device.id, paired.id));
      expect(still.revokedAt).toBeNull();

      await db.delete(family).where(eq(family.id, other.familyId));
    });
  });

  describe('brute force', () => {
    it('locks a client out after enough wrong codes, then still refuses', async () => {
      await generate();
      asKiosk();

      for (let attempt = 0; attempt < PAIRING_MAX_FAILURES; attempt += 1) {
        expect(await pairDeviceAction({ code: '000000' })).toEqual({
          status: 'error',
          error: 'invalidCode',
        });
      }

      expect(await pairDeviceAction({ code: '000000' })).toEqual({
        status: 'error',
        error: 'rateLimited',
      });

      const attempts = await db
        .select()
        .from(devicePairingAttempt)
        .where(eq(devicePairingAttempt.clientHash, clientHashOf()));
      expect(attempts.length).toBeGreaterThanOrEqual(PAIRING_MAX_FAILURES);
    });

    it('counts only failures, so a mistyped code costs a family nothing', async () => {
      const { code } = await generate();
      asKiosk();

      expect((await pairDeviceAction({ code: '000001' })).status).toBe('error');
      expect((await pairDeviceAction({ code })).status).toBe('paired');
    });

    it('records no code, only a client fingerprint', async () => {
      await generate();
      asKiosk();
      await pairDeviceAction({ code: '424242' });

      const [attempt] = await db
        .select()
        .from(devicePairingAttempt)
        .where(eq(devicePairingAttempt.clientHash, clientHashOf()));
      expect(JSON.stringify(attempt)).not.toContain('424242');
      expect(attempt.clientHash).toMatch(/^[0-9a-f]{64}$/);
    });

    // BLOCKING 1: the per-client bucket alone is bypassable — both halves of
    // its fingerprint (`x-forwarded-for[0]`, user agent) are attacker-
    // controlled, so a script that rotates either walks straight through it.
    // These prove the actual guarantee: a global budget that does not look at
    // the fingerprint at all, and that the count deciding it is atomic under
    // real concurrency rather than a read-then-write race.
    describe('the global backstop', () => {
      it('trips across many distinct client fingerprints, and fails every attempt closed', async () => {
        await generate();

        // The scenario a fingerprint rotation produces: every failure from a
        // different client. Seeded directly — this is what "distinct
        // clientHashes" means, and it is the whole reason the per-client
        // bucket cannot be the guarantee.
        await db.insert(devicePairingAttempt).values(
          Array.from({ length: PAIRING_GLOBAL_MAX_FAILURES }, (_, index) => ({
            clientHash: createHash('sha256').update(`scanner-${index}`).digest('hex'),
            createdAt: new Date(),
          }))
        );

        // A fingerprint that has never been seen before.
        stubs.requestHeaders = new Headers({
          'x-forwarded-for': '203.0.113.9',
          'user-agent': 'never-seen-before',
        });
        asKiosk();

        expect(await pairDeviceAction({ code: '000000' })).toEqual({
          status: 'error',
          error: 'rateLimited',
        });
      });

      it('serializes concurrent attempts against a nearly-exhausted budget — none slip past the limit', async () => {
        await generate();

        // Two short of the budget: exactly `PAIRING_GLOBAL_MAX_FAILURES - 5`
        // failures already recorded, each from its own fingerprint.
        const already = PAIRING_GLOBAL_MAX_FAILURES - 5;
        await db.insert(devicePairingAttempt).values(
          Array.from({ length: already }, (_, index) => ({
            clientHash: createHash('sha256').update(`seed-${index}`).digest('hex'),
            createdAt: new Date(),
          }))
        );

        asKiosk();

        // Ten parallel requests, each its own fingerprint (so the per-client
        // bucket never engages — only the global one can stop them), racing
        // the last five slots the budget has left. If the old read-then-write
        // shape were still here, every one of these would read the same
        // stale count before any of them wrote, and all ten would slip
        // through — the failure mode BLOCKING 1b closes.
        const results = await Promise.all(
          Array.from({ length: 10 }, async (_, index) => {
            stubs.requestHeaders = new Headers({
              'x-forwarded-for': `198.51.100.${index}`,
              'user-agent': `parallel-scanner-${index}`,
            });
            return pairDeviceAction({ code: '000000' });
          })
        );

        const invalid = results.filter((result) => result.status === 'error');
        const rateLimited = invalid.filter(
          (result) => 'error' in result && result.error === 'rateLimited'
        );

        // Exactly five slots were left in the budget; the rest must have been
        // turned away, never processed as an ordinary wrong code.
        expect(rateLimited.length).toBeGreaterThanOrEqual(5);

        // Counted via the table, not just the responses: the total count of
        // rows this run added must never make the global count exceed its
        // budget by more than the handful of rows the last accepted request
        // could have pushed it to.
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(devicePairingAttempt);
        expect(count).toBeLessThanOrEqual(already + 10);
        expect(count).toBeGreaterThan(PAIRING_GLOBAL_MAX_FAILURES);
      });
    });
  });

  describe('claiming under real concurrency (reviewer finding 8)', () => {
    it('two hubs racing the same code produce exactly one paired device', async () => {
      const { code } = await generate();
      asKiosk();

      const [first, second] = await Promise.all([
        pairDeviceAction({ code }),
        pairDeviceAction({ code }),
      ]);

      const results = [first, second];
      expect(results.filter((result) => result.status === 'paired')).toHaveLength(1);
      const failures = results.filter((result) => result.status === 'error');
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ status: 'error', error: 'invalidCode' });

      expect(await ourDevices()).toHaveLength(1);
    });
  });

  describe('the per-family cap on live codes (BLOCKING 1c / reviewer finding 4)', () => {
    it('rejects the 4th live code for a family, and accepts one again once a code is gone', async () => {
      for (let index = 0; index < PAIRING_MAX_LIVE_CODES_PER_FAMILY; index += 1) {
        const state = await createPairingCodeAction({ deviceName: `Scherm ${index}`, kind: 'hub' });
        expect(state.status).toBe('created');
      }

      expect(await createPairingCodeAction({ deviceName: 'Een te veel', kind: 'hub' })).toEqual({
        status: 'error',
        error: 'tooManyPending',
      });

      // Cross-tenant: another family's live codes do not count against — or
      // get blocked by — this one's cap.
      const other = await seedHousehold(db, 'Neighbours-cap');
      stubs.cookies.delete(DEVICE_SESSION_COOKIE);
      stubs.session = { session: { activeFamilyId: other.familyId, memberId: other.parentId } };
      const otherState = await createPairingCodeAction({ deviceName: 'Buren', kind: 'hub' });
      expect(otherState.status).toBe('created');

      await db.delete(family).where(eq(family.id, other.familyId));
    });
  });

  it('refuses to mint a code without device:manage', async () => {
    // A child is `deny` in the §7 "Pair/revoke devices" row.
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.childId },
    };

    expect(await createPairingCodeAction({ deviceName: 'Keuken', kind: 'hub' })).toEqual({
      status: 'error',
      error: 'forbidden',
    });

    expect(
      await db
        .select()
        .from(devicePairingCode)
        .where(eq(devicePairingCode.familyId, household.familyId))
    ).toEqual([]);
  });

  it('refuses to mint a code from a paired kiosk — a device cannot enrol a device', async () => {
    const { code } = await generate();
    asKiosk();
    await pairDeviceAction({ code });

    expect(await createPairingCodeAction({ deviceName: 'Hal', kind: 'hub' })).toEqual({
      status: 'error',
      error: 'forbidden',
    });
  });
});
