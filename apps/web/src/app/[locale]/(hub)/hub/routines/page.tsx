import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import { completeStepAction } from '@/modules/routines';
import { toggleTaskAction } from '@/modules/tasks';
import {
  RoutinesBoard,
  TodayHeader,
  TodayLive,
  loadHubBoardComposition,
  loadRoutinesBoardData,
} from '@/modules/today';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * "Taken & routines" — the family-wide board (M-R2): one pool column for
 * tasks nobody has picked up yet, one column per member, routines banded by
 * the selected daypart and tasks always underneath.
 *
 * M-R1's `TodayTabRoutines` (a per-child check-in, read-only from here) is
 * gone from this route — this is the control surface itself, per M-R2. A
 * child who wants to tick off a *routine* step still has their own face on
 * the board too (`/hub/routines/[memberId]`, unchanged, and still the
 * larger single-child experience with praise and confetti); this route ticks
 * the same underlying completion, just for the whole household at once.
 */
export default async function HubRoutinesOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { date, now } = await searchParams;
  await requireHubDevice(locale, '/hub/routines', { date, now });

  const composition = await loadHubBoardComposition({ date, now });
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');

  if (!composition) {
    // Unreachable in practice — see the same fallback on `/hub`.
    return (
      <main className="min-h-full">
        <EmptyState
          size="hub"
          heading
          title={tCalendar('hub.unpairedTitle')}
          description={tCalendar('hub.unpairedBody')}
        />
      </main>
    );
  }

  const { data, dayKey, isToday, slot } = composition;

  // Board data — routines and tasks — is a today-only concept, exactly like
  // `TodayTabRoutines`'s old `kids` read: a browsed day has no completions of
  // its own to show, so the panel says so rather than rendering an empty
  // board that looks like nobody has anything to do.
  const board = isToday ? await loadRoutinesBoardData({ now: data.now }) : null;

  return (
    <main
      className="flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-routines-overview"
    >
      <TodayLive />

      <HubBoard
        familyId={data.familyId}
        greeting={t(`hubGreeting.${slot}`)}
        snapshot={{
          generatedAt: data.now.getTime(),
          anchor: data.anchor,
          now: data.now,
          timeZone: data.timeZone,
          view: data.view,
          weekStartsOn: data.weekStartsOn,
          members: data.members,
          events: data.events,
        }}
      >
        <TodayHeader
          surface="hub"
          greeting={t(`hubGreeting.${slot}`)}
          anchor={data.anchor}
          now={data.now}
          timeZone={data.timeZone}
          dayKey={dayKey}
          isToday={isToday}
          members={data.members}
          href="/hub/routines"
        />

        {board ? (
          <RoutinesBoard
            board={board}
            dayKey={dayKey}
            completeStepAction={completeStepAction}
            toggleTaskAction={toggleTaskAction}
          />
        ) : (
          <p className="text-body-sm text-ink-secondary">{t('routines.otherDay')}</p>
        )}
      </HubBoard>
    </main>
  );
}
