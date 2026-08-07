import { readHealth } from '@/server/health';

/**
 * `GET /api/health` — the platform liveness/readiness probe (M18).
 *
 * Railway's `healthcheckPath` (see `railway.json`) polls this after every
 * deploy and rolls back if it never turns green, so it is deliberately
 * unauthenticated and family-agnostic; `src/server/health.ts` documents why
 * that is safe and what the response may contain.
 *
 * 200 when the database answered, 503 when it did not — the distinction is the
 * whole point of a health check, and a container whose database is unreachable
 * must not be routed traffic.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const report = await readHealth();

  return Response.json(report, {
    status: report.database.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
