// Direct domain import, not the `@/modules/calendar` barrel: that barrel also
// re-exports `server-only` reads (`page-data.ts`), which is fatal to pull into
// this module's other importer, the client component `today-clock.tsx`. The
// same workaround `modules/routines/domain/schedule.ts` and
// `modules/sharing/view/load.ts` already use for the same reason.
import { toDateKey, toWall } from '@/modules/calendar/domain/zone';

/**
 * Has the household's local day moved past the one a render was seeded with?
 *
 * Pure and framework-free (architecture §2 rule 2), exactly like `flow.ts`, so
 * `today-clock.tsx`'s tick has one line of logic and this has all of it.
 *
 * `/today`'s heading and its data window (`dayKeysOf` in the route) are both
 * computed once, at server-render time, from `new Date()` in the household's
 * `timeZone`. A tab left open across midnight never re-renders on its own —
 * nothing about the clock ticking changes any React state — so both freeze at
 * whichever day was current when the page was last rendered. This is the
 * question a client tick asks on every beat to notice that and ask the server
 * to render again (`today-clock.tsx`): comparing wall dates, not instants,
 * because "24 hours later" and "the next local day" are different questions
 * around a DST transition and this one is the one a wall display cares about.
 */
export function hasRolledOver(dayKey: string, now: Date, timeZone: string): boolean {
  return toDateKey(toWall(now, timeZone)) !== dayKey;
}
