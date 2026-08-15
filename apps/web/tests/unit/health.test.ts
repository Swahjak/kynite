import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/server/db';
import { readHealth } from '@/server/health';
import { resetEnvCache } from '@/server/env';

/**
 * The health probe's failure posture (M18).
 *
 * The integration suite proves the happy path against a real database; what is
 * worth pinning without one is the behaviour when Postgres is *gone*, because
 * that is the case the endpoint exists for — and the case where an
 * unauthenticated route is most tempted to echo a driver error to whoever asked.
 */
function failingDatabase(error: Error): Database {
  return {
    select: () => ({
      from: () => Promise.reject(error),
    }),
  } as unknown as Database;
}

function emptyDatabase(): Database {
  return {
    select: () => ({
      from: () => Promise.resolve([{ lastSyncedAt: null }]),
    }),
  } as unknown as Database;
}

describe('readHealth', () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://unused/health';
    process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.JOBS_ENABLED = 'true';
    resetEnvCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...saved };
    resetEnvCache();
    vi.restoreAllMocks();
  });

  it('reports degraded — not a throw — when the database is unreachable', async () => {
    const report = await readHealth(failingDatabase(new Error('ECONNREFUSED 10.0.0.4:5432')));

    expect(report.status).toBe('degraded');
    expect(report.database.ok).toBe(false);
    expect(report.sync.lastSyncedAt).toBeNull();
  });

  it('never puts the database error in the response body', async () => {
    const secret = 'postgresql://kynite:hunter2@db.internal:5432/kynite';
    const report = await readHealth(failingDatabase(new Error(`connect failed: ${secret}`)));

    expect(JSON.stringify(report)).not.toContain('hunter2');
    expect(JSON.stringify(report)).not.toContain('db.internal');
    expect(JSON.stringify(report)).not.toContain('connect failed');
  });

  it('treats a never-synced deployment as healthy', async () => {
    const report = await readHealth(emptyDatabase());

    expect(report.status).toBe('ok');
    expect(report.database.ok).toBe(true);
    expect(report.sync.lastSyncedAt).toBeNull();
  });

  it('reports whether this process runs the in-process workers', async () => {
    expect((await readHealth(emptyDatabase())).jobs.enabled).toBe(true);

    process.env.JOBS_ENABLED = 'false';
    resetEnvCache();

    expect((await readHealth(emptyDatabase())).jobs.enabled).toBe(false);
  });
});
