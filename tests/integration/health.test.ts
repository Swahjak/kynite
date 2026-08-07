import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * `GET /api/health` against a real Postgres (M18 criterion: "reports DB
 * connectivity plus last successful sync").
 *
 * The unit half — the degraded path, the leak-freedom of the payload — lives
 * in `tests/unit/health.test.ts`; what needs a database is the claim that
 * `sync.lastSyncedAt` actually tracks `calendar.synced_at`, which a mock would
 * assert about itself.
 */
describe.skipIf(!databaseUrl)('health probe (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let googleAccountId: string;
  let readHealth: typeof import('@/server/health').readHealth;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    ({ readHealth } = await import('@/server/health'));

    household = await seedHousehold(db, 'Health');

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `health-${randomUUID()}`,
        email: `health-${randomUUID()}@example.test`,
      })
      .returning();

    googleAccountId = account.id;
  }, 60_000);

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  it('reports the database as reachable', async () => {
    const report = await readHealth(db);

    expect(report.database.ok).toBe(true);
    expect(report.status).toBe('ok');
  });

  it('reports the most recent successful sync across the deployment', async () => {
    // Far enough in the future that no other row in a shared test database can
    // outrank it — the probe is a global max, so the assertion has to be too.
    const syncedAt = new Date('2099-01-02T03:04:05.000Z');

    await db.insert(schema.calendar).values({
      familyId: household.familyId,
      googleAccountId,
      googleCalendarId: `health-${randomUUID()}`,
      summary: 'Health',
      syncedAt,
    });

    const report = await readHealth(db);

    expect(report.sync.lastSyncedAt).toBe(syncedAt.toISOString());
  });

  it('leaks nothing beyond status flags and one timestamp', async () => {
    const report = await readHealth(db);

    // The exact shape is the contract: an unauthenticated endpoint may only
    // ever grow a new key on purpose, so the test fails if one appears.
    expect(Object.keys(report).sort()).toEqual(['database', 'jobs', 'status', 'sync']);
    expect(Object.keys(report.database)).toEqual(['ok']);
    expect(Object.keys(report.sync)).toEqual(['lastSyncedAt']);
    expect(Object.keys(report.jobs)).toEqual(['enabled']);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(household.familyId);
    expect(serialized).not.toContain(googleAccountId);
    expect(serialized).not.toContain('@example.test');
  });
});
