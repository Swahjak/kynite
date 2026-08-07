import { NextResponse, type NextRequest } from 'next/server';
import { assertCan } from '@/modules/family';
import { listFamilyCalendars, syncCalendarById } from '@/modules/google';

/**
 * Run one Google pull, synchronously (M17).
 *
 * Why this exists at all: production sync is a pg-boss job, and the e2e server
 * runs with `JOBS_ENABLED=false` because a background worker would install its
 * schema in the throwaway database and add timing nondeterminism to every
 * other spec (see `playwright.config.ts`). That leaves the sync-smoke journey
 * with nothing to await — `enqueueCalendarSync` lands a row nobody picks up.
 *
 * So this route is a *trigger*, not a stub: it calls the same
 * `syncCalendarById` the job handler calls, against the same store, the same
 * engine and the same HTTP client. Nothing internal is faked; the only thing
 * standing in for a third party is Google itself, at the network boundary
 * (`GOOGLE_API_BASE_URL`). Under the M17 rule "Google is the only mocked
 * boundary", a route that runs real code earlier than a worker would is on the
 * right side of the line — a route that returned canned events would not be.
 *
 * It lives under `/api/dev/*` and is gated exactly like the `/dev/*` tree:
 * 404 in production, structurally, before it reads anything.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  // Still authorized, even as dev tooling: the caller must be a principal who
  // could have triggered this sync through the product (`google:link`), so the
  // route cannot be used to pull somebody else's calendar.
  let principal;
  try {
    principal = await assertCan('google:link');
  } catch {
    return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const calendarId =
    body && typeof body === 'object' && 'calendarId' in body ? String(body.calendarId) : '';
  if (!calendarId) {
    return NextResponse.json({ ok: false, reason: 'no_calendar' }, { status: 400 });
  }

  // `syncCalendarById` loads the row by bare id with no family filter — the
  // authorization above only proves the caller can sync *some* calendar, not
  // this one. Without this check any signed-in principal could pull any
  // other family's calendar by id.
  const familyCalendars = await listFamilyCalendars(principal.familyId);
  if (!familyCalendars.some((row) => row.id === calendarId)) {
    return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 404 });
  }

  const result = await syncCalendarById(calendarId);
  return NextResponse.json({ ok: Boolean(result), result });
}
