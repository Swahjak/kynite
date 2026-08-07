import 'server-only';
import { sql } from 'drizzle-orm';
import { db, type Database } from '@/server/db';
import { calendar } from '@/server/db/schema';
import { env } from '@/server/env';

/**
 * Platform health probe (M18 criterion: "`GET /api/health` returns HTTP 200 in
 * production and reports DB connectivity plus last successful sync").
 *
 * Three deliberate properties, because a health endpoint is by definition
 * reachable by anyone who can reach the host:
 *
 * 1. **Family-agnostic.** There is no principal, no family id, and no
 *    per-family reading anywhere in here. The sync timestamp is a global
 *    `max()` across every calendar row — it says "this deployment last talked
 *    to Google at T", not "the Jansen household synced at T".
 * 2. **No authentication.** Railway's health check runs before any session
 *    exists and carries no cookie; a probe that 401s is a deploy that never
 *    goes healthy. Which is only safe because of (3).
 * 3. **No data.** The response is booleans and one timestamp. No counts, no
 *    names, no ids, no error strings — a failed database check reports `false`
 *    and the reason goes to the process log, not to the caller. An unauthenticated
 *    endpoint that echoes a driver error is an information leak with extra steps.
 */
export type HealthReport = {
  /** `ok` when the database answered; `degraded` when it did not. */
  status: 'ok' | 'degraded';
  database: { ok: boolean };
  /**
   * The most recent successful Google calendar sync across the whole
   * deployment, or `null` when nothing has ever synced (a fresh install, which
   * is healthy — hence this never affects `status`).
   */
  sync: { lastSyncedAt: string | null };
  /** Whether this process runs the in-process pg-boss workers (§10). */
  jobs: { enabled: boolean };
};

/**
 * One round trip does both jobs: the aggregate proves the pool can reach
 * Postgres *and* yields the sync timestamp, so a healthy probe costs a single
 * query rather than a `SELECT 1` plus a read.
 */
export async function readHealth(database: Database = db): Promise<HealthReport> {
  let lastSyncedAt: string | null = null;
  let databaseOk = false;

  try {
    const [row] = await database
      .select({ lastSyncedAt: sql<Date | null>`max(${calendar.syncedAt})` })
      .from(calendar);

    databaseOk = true;
    lastSyncedAt = row?.lastSyncedAt ? new Date(row.lastSyncedAt).toISOString() : null;
  } catch (error) {
    // Logged, never returned: see (3) above.
    console.error('[health] database check failed', error);
  }

  return {
    status: databaseOk ? 'ok' : 'degraded',
    database: { ok: databaseOk },
    sync: { lastSyncedAt },
    jobs: { enabled: env.JOBS_ENABLED },
  };
}
