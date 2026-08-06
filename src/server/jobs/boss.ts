import 'server-only';
import { PgBoss } from 'pg-boss';
import { env } from '@/server/env';

/**
 * pg-boss lifecycle (docs/architecture.md §9 "jobs", §10 "One process; jobs
 * in-process").
 *
 * This module owns the instance and nothing else — no queue definitions, no
 * handlers — so a slice can enqueue work without importing the registration
 * graph (and without an import cycle back through itself).
 *
 * Workers boot from `src/instrumentation.ts`, which Next.js runs once per
 * server bootstrap. `JOBS_ENABLED=false` starts the web process without them
 * (§10's "second `JOBS_ENABLED=false` web process", and the e2e run, where a
 * background worker would only add nondeterminism).
 */

let boss: PgBoss | undefined;
let starting: Promise<PgBoss> | undefined;

export function jobsEnabled(): boolean {
  return env.JOBS_ENABLED;
}

/** The running instance, or `undefined` when workers are not booted. */
export function getBoss(): PgBoss | undefined {
  return boss;
}

/** Starts (once) and returns the instance. Safe to call concurrently. */
export function startBoss(): Promise<PgBoss> {
  starting ??= (async () => {
    const instance = new PgBoss({
      connectionString: env.DATABASE_URL,
      // A small dedicated pool: §10 sizes Postgres for app (10) + SSE (20) +
      // pg-boss (5).
      max: 5,
      schema: 'pgboss',
    });

    // A failing job must never take the web process down with it.
    instance.on('error', (error) => {
      console.error('[jobs] pg-boss error', error);
    });

    await instance.start();
    boss = instance;
    return instance;
  })();

  return starting;
}

export async function stopBoss(): Promise<void> {
  const instance = boss;
  boss = undefined;
  starting = undefined;
  if (instance) await instance.stop({ graceful: true });
}

/**
 * Enqueue without caring whether workers run in this process: pg-boss `send()`
 * is a database insert, so a web-only process can still queue work for the
 * worker process to pick up.
 *
 * `JOBS_ENABLED=false` gates *workers and schedules* only (see `startJobs`
 * in `src/instrumentation.ts`) — it must NOT gate sends. A web-only process
 * (or an e2e run) with workers off still needs `send()` to land rows in the
 * queue; a background worker elsewhere (or a later run with workers on) picks
 * them up. Guarding `enqueue` on `jobsEnabled()` would silently drop work in
 * exactly that configuration.
 */
export async function enqueue(
  name: string,
  data: object = {},
  options: Parameters<PgBoss['send']>[2] = {}
): Promise<string | null> {
  const instance = boss ?? (await startBoss());
  return instance.send(name, data, options);
}
