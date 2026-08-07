import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { DEVICE_SESSION_COOKIE, deviceSessionExpiry, hashDeviceToken } from '@/lib/device-session';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * Self-unpair (BLOCKING 2, `src/app/api/devices/session/unpair/route.ts`).
 *
 * Before this route existed, a browser that was ever paired had no way back:
 * the device cookie is httpOnly (unreadable and undeletable from client
 * script), `(app)/layout.tsx` sends a device principal to `/hub` before it
 * ever renders the parent app, `getPrincipal()` resolves the device *before*
 * any account session, and there was no revocation affordance the device
 * itself could reach — only `device:manage`, which the §7 matrix denies to a
 * device outright. A parent who accidentally paired their own laptop was
 * locked out of their own family's data with no recovery but the database.
 *
 * This proves the route does what it claims, end to end against a real
 * device/session pair: it revokes the row (the same write `revokeDeviceAction`
 * makes), it publishes `device.revoked`, and it clears the cookie — and that
 * the credential is genuinely dead afterwards, not just the cookie gone from
 * this one response.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
  cookies: new Map<string, string>(),
  deleted: [] as string[],
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
    delete: (name: string) => {
      stubs.cookies.delete(name);
      stubs.deleted.push(name);
    },
  }),
}));
// `@/modules/family`'s barrel re-exports client components (`SignOutButton`
// among them), which drag in `@/i18n/navigation`'s `next-intl` wrapper — the
// same reason every other test in this directory that imports the barrel
// mocks it rather than letting the real module resolve `next/navigation` in
// a Node test environment.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const { POST } = await import('@/app/api/devices/session/unpair/route');
const { getPrincipal } = await import('@/modules/family/principal');

vi.setConfig({ testTimeout: 20_000 });

describe.skipIf(!databaseUrl)('self-unpair (integration)', () => {
  const { pool, db } = createTestDb();
  const { device, deviceSession, family } = schema;

  let household: Household;
  let deviceId: string;
  let token: string;

  beforeAll(() => {
    stubs.db = db;
  });

  beforeEach(async () => {
    household = await seedHousehold(db, 'Unpair');

    const [row] = await db
      .insert(device)
      .values({ familyId: household.familyId, name: 'Keuken', kind: 'hub' })
      .returning();
    deviceId = row.id;

    token = `token-${row.id}`;
    await db.insert(deviceSession).values({
      deviceId: row.id,
      tokenHash: hashDeviceToken(token),
      expiresAt: deviceSessionExpiry(new Date()),
    });

    stubs.session = null;
    stubs.cookies = new Map([[DEVICE_SESSION_COOKIE, token]]);
    stubs.deleted = [];
  });

  afterEach(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
  });

  afterAll(async () => {
    await pool.end();
  });

  it('revokes the device, clears the cookie, and leaves the session invalid afterwards', async () => {
    // Sanity: a real device principal before we touch anything.
    expect(await getPrincipal()).toEqual({
      kind: 'device',
      familyId: household.familyId,
      deviceId,
    });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'unpaired' });

    // The cookie is gone from the jar this response wrote to.
    expect(stubs.deleted).toContain(DEVICE_SESSION_COOKIE);
    expect(stubs.cookies.has(DEVICE_SESSION_COOKIE)).toBe(false);

    const [row] = await db.select().from(device).where(eq(device.id, deviceId));
    expect(row.revokedAt).not.toBeNull();

    const [session] = await db
      .select()
      .from(deviceSession)
      .where(eq(deviceSession.deviceId, deviceId));
    expect(session.revokedAt).not.toBeNull();

    // Not just "the cookie is gone" — the credential itself no longer
    // resolves, even if a copy of the token were replayed.
    stubs.cookies.set(DEVICE_SESSION_COOKIE, token);
    expect(await getPrincipal()).toBeNull();

    const [published] = await db
      .select()
      .from(schema.eventLog)
      .where(
        and(
          eq(schema.eventLog.familyId, household.familyId),
          eq(schema.eventLog.type, 'device.revoked')
        )
      );
    expect(published.payload.entity.id).toBe(deviceId);
    expect(published.payload.actor.deviceId).toBe(deviceId);
    expect(published.payload.actor.source).toBe('hub');
  });

  it('refuses a request with no device principal — there is no credential to surrender', async () => {
    stubs.cookies = new Map();

    const response = await POST();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'not_a_device' });

    const [row] = await db.select().from(device).where(eq(device.id, deviceId));
    expect(row.revokedAt).toBeNull();
  });

  it('is idempotent — unpairing an already-revoked device does not error', async () => {
    await POST();
    stubs.cookies.set(DEVICE_SESSION_COOKIE, token);

    const response = await POST();

    // getPrincipal() no longer resolves this device (revoked), so the second
    // call is indistinguishable from "no credential" — the safe outcome.
    expect(response.status).toBe(403);
  });
});
