import { getEnv } from '@/server/env';

/**
 * Next.js runs `register()` once per server bootstrap. Validating the
 * environment here turns a missing secret into an immediate, loud boot failure
 * instead of a 500 on the first request that happens to read `env.*`.
 *
 * `next build` also bootstraps a worker that calls `register()`, so the
 * production-build phase is skipped explicitly: builds must stay secret-free
 * (see `src/server/env.ts` — validation is lazy for exactly that reason).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  getEnv();
}
