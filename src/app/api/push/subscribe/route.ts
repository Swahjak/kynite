import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPrincipal } from '@/modules/family';
import {
  PushEndpointConflictError,
  deletePushSubscriptionByEndpoint,
  isPushConfigured,
  upsertPushSubscription,
} from '@/modules/notifications';

/**
 * VAPID subscription upsert (docs/architecture.md §2's route table, §6 step 2).
 *
 * A route handler rather than a Server Action, deliberately: the body is a
 * `PushSubscription` the browser produced, the caller is the service-worker
 * registration flow, and both `POST` (subscribe) and `DELETE` (unsubscribe)
 * are the same resource. §7's `assertCan()` chokepoint is about *Server
 * Actions*; the equivalent here is that every write is scoped to the
 * principal's own family and member, and the principal comes from the session,
 * never from the body.
 *
 * There is no capability for "subscribe myself to notifications" in the §7
 * matrix and there should not be: it is not an action on the household, it is
 * a device telling us where to reach the person already signed in. So the
 * check is "is there a member principal", and nothing in the payload can
 * widen it.
 */
export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.url().max(2048) });

export async function POST(request: Request): Promise<NextResponse> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!isPushConfigured()) {
    // Storing an endpoint we could never send to would be a silent lie in the
    // settings panel ("notifications on") — say so instead.
    return NextResponse.json({ error: 'pushNotConfigured' }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = subscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalidSubscription' }, { status: 400 });
  }

  let row;
  try {
    row = await upsertPushSubscription({
      familyId: principal.familyId,
      memberId: principal.memberId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: request.headers.get('user-agent'),
    });
  } catch (error) {
    // The endpoint belongs to another household. Answered with the same
    // generic failure a malformed body gets, and deliberately: a distinct
    // "taken" response would turn this route into an oracle for whether a
    // given endpoint is registered somewhere in the install.
    if (error instanceof PushEndpointConflictError) {
      return NextResponse.json({ error: 'invalidSubscription' }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json(
    { id: row.id, endpoint: row.endpoint },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalidSubscription' }, { status: 400 });
  }

  // Family-scoped: unsubscribing is deleting *your household's* row for this
  // endpoint, so a stale endpoint from another family is a no-op, not a
  // cross-tenant delete.
  const deleted = await deletePushSubscriptionByEndpoint(parsed.data.endpoint, principal.familyId);

  return NextResponse.json({ deleted }, { headers: { 'Cache-Control': 'no-store' } });
}
