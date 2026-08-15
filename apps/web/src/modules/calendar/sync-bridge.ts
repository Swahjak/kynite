import 'server-only';
import { pushEventWithRetry } from '@/modules/google';

/**
 * The Kynite → Google write path, from the calendar slice's side
 * (docs/architecture.md §5 "Write path (2-way)").
 *
 * §5 wants the push to be *synchronous on the user action*, so a parent sees
 * the real result rather than an optimistic guess. But a Google outage must
 * never fail a local edit — the event is already written and correct. So:
 *
 *   try to push now → on failure, record `pendingSyncAt` and hand the retry
 *   to the `google:push-event` job, which owns backoff.
 *
 * `pendingSyncAt` is the M05 carry-forward this milestone resolves: a nullable
 * timestamp, set on push failure and cleared on the next success, is enough to
 * drive the non-blocking sync pip and needs no separate boolean.
 *
 * B1 carry-forward: this used to duplicate that "set on failure, clear on
 * success" logic locally, while the `google:push-event` job worker called
 * `pushEventById` directly — so a retry that finally succeeded never cleared
 * `pendingSyncAt`, and the pip stuck forever. The logic now lives once, in
 * `@/modules/google`'s `pushEventWithRetry`, and this is a thin alias so both
 * the Server Actions (this file's callers) and the job worker
 * (`@/modules/google/jobs`) run the identical wrapper rather than two copies
 * that can drift. Native events (`calendarId === null`) and unsyncable
 * calendars never touch Google at all — `pushEventWithRetry` treats that as a
 * `'skipped'` outcome, not a failure, and still clears `pendingSyncAt` (N6).
 *
 * N5 carry-forward: previously this comment claimed "the next poll repairs
 * it" for a push that fails *and* whose retry enqueue also fails (queue
 * unavailable). That was false — poll only pulls. `google:poll`
 * (`@/modules/google/jobs`) now also re-enqueues a `google:push-event` for
 * every event still carrying `pendingSyncAt`, which is what makes the claim
 * true.
 */
export const pushToGoogle = pushEventWithRetry;
