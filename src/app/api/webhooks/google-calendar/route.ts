import { NextResponse, type NextRequest } from 'next/server';
import {
  channelTokenFor,
  decideNotification,
  enqueueCalendarSync,
  findCalendarByChannelId,
  readNotification,
} from '@/modules/google';

/**
 * Google Calendar push notifications (docs/architecture.md §5 "Push channels").
 *
 * The contract is speed: verify `X-Goog-Channel-Token`, match
 * `X-Goog-Resource-ID`, **enqueue** and return — one indexed lookup and one
 * job insert, never an inline sync. Google retries aggressively on a slow
 * webhook and disables channels that keep timing out.
 *
 * Every outcome answers `200`. A rejected notification is *not* retried into
 * health: a 4xx would make Google redeliver a notification we will keep
 * refusing, and eventually kill a channel that may still be legitimate. The
 * decision is carried in the body for observability instead.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const notification = readNotification(request.headers);

  if (!notification.channelId) {
    return NextResponse.json({ ok: false, reason: 'missing_channel_id' }, { status: 200 });
  }

  const calendar = await findCalendarByChannelId(notification.channelId);

  const decision = decideNotification(
    notification,
    calendar
      ? {
          calendarId: calendar.id,
          channelResourceId: calendar.channelResourceId,
          expectedToken: channelTokenFor(notification.channelId),
          syncEnabled: calendar.syncEnabled,
        }
      : null
  );

  if (decision.action !== 'sync') {
    return NextResponse.json({ ok: decision.action === 'ignore', ...decision }, { status: 200 });
  }

  // The notification is content-free by design, so the job always does a plain
  // incremental sync — there is nothing in the request worth passing along.
  const jobId = await enqueueCalendarSync(decision.calendarId);

  if (jobId === null) {
    // `enqueue` only returns null if pg-boss itself failed to start (see
    // `src/server/jobs/boss.ts`) — not a normal outcome. Surface it as a
    // failure so it shows up in logs/alerts; Google will retry the
    // notification on a non-2xx, which is the desired behavior here (unlike
    // the `decision.action !== 'sync'` branches above, which are correct
    // rejections, not failures).
    console.error('[webhooks] google-calendar enqueue failed', {
      calendarId: decision.calendarId,
    });
    return NextResponse.json({ ok: false, reason: 'enqueue_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, action: 'queued' }, { status: 200 });
}
