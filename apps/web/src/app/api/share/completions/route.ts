import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { recordCompletion } from '@/modules/routines';
import { resolveShareLink } from '@/modules/sharing';

/**
 * `POST /api/share/completions` — the **only** way a caregiver link changes
 * anything (M13).
 *
 * **Why a route handler and not a Server Action.** Architecture §2 rule 3 says
 * every mutation is a Server Action, with webhooks and the Google OAuth
 * callback as the standing exceptions. This is a third, and it exists because
 * two other rules in the same document make a Server Action impossible here:
 * the `(share)` tree imports zero Server Actions (§2, "must be impossible to
 * reach a mutation from this tree"), and `src/proxy.ts` refuses every non-GET
 * request to `/s/*`. A Server Action is a POST *to the page that rendered it* —
 * so the two constraints together do not merely discourage one, they forbid it.
 * The contributor grade in the §7 matrix is real, though, so the write has to
 * arrive somewhere: it arrives here, outside the tree and outside the proxy's
 * share matcher, carrying the same discipline §2 rule 3 asks of an action.
 *
 * **The token is re-resolved here, server-side.** Nothing about the caller is
 * trusted: not the referring page, not a header, not the shape of the request.
 * The body's token is hashed and matched exactly as the page's own render did,
 * and the resulting principal is a `share` principal — which the §7 matrix
 * grades `scoped` for `completion:write` when the role is `contributor` and
 * `deny` when it is `viewer`. A viewer link posting here is refused by the
 * matrix, not by an `if`.
 *
 * **The scope check is on the subject member.** `recordCompletion` asks
 * `can(principal, 'completion:write', { memberId })`, and `decide()` fails
 * closed on a member outside `scope.memberIds` — including the case where the
 * resource carries no member at all. That is the out-of-scope denial, and it
 * lives in the chokepoint rather than here.
 *
 * `tests/unit/server-action-authorization.test.ts` only audits `'use server'`
 * modules, so this file is invisible to it by construction. The authorization
 * it cannot see is inside `recordCompletion`, which is exactly why the check
 * was put there rather than here when the write was extracted.
 */
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(1).max(200),
  routineId: z.uuid(),
  routineStepId: z.uuid(),
  memberId: z.uuid(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  clientId: z.string().trim().min(8).max(200),
});

const NO_STORE = {
  'Cache-Control': 'no-store',
  // The same two headers the share pages carry. This route is outside
  // `src/proxy.ts`'s matcher (it skips `api/`), so it sets its own rather than
  // inheriting them — a JSON endpoint that leaks a token in a `Referer` leaks
  // it just as completely as an HTML one.
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ status: 'invalid' }, { status: 400, headers: NO_STORE });
  }

  const { token, ...input } = parsed.data;

  const resolution = await resolveShareLink(token);
  if (resolution.status !== 'ok') {
    // One response for expired, revoked and never-existed, matching the page's
    // gone state: an anonymous caller learns nothing about which it was.
    return NextResponse.json({ status: 'gone' }, { status: 403, headers: NO_STORE });
  }

  const result = await recordCompletion(resolution.principal, {
    ...input,
    // A caregiver's phone is a mobile client as far as the ledger is concerned.
    // `completion_source` is a Postgres enum, so adding a `share` value would be
    // a migration for a distinction nothing currently reads — the share link is
    // already identifiable by the actor carrying neither member nor device.
    source: 'mobile',
  });

  if (result.status === 'error') {
    // `forbidden` is the out-of-scope case (or a `viewer` link). Everything
    // else is a malformed or stale request. Neither tells the caller *why*.
    const status = result.error === 'forbidden' ? 403 : 409;
    return NextResponse.json({ status: 'refused' }, { status, headers: NO_STORE });
  }

  return NextResponse.json({ status: 'done' }, { headers: NO_STORE });
}
