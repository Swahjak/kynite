import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
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
 * "Taken" — the family-wide board (2026-09-14 taken-board-routines-page
 * plan, M1+M2). Moved here from `/hub/routines`, which is now a temporary
 * redirect to this route until M3 replaces it with the family-wide "Actieve
 * routines" page: one pool column for tasks nobody has picked up yet, one
 * column per member, a collapsed routine progress card at the top of a
 * column (linking to that member's own `/hub/routines/[memberId]`) and that
 * member's tasks underneath.
 *
 * `TodayTabRoutines` (a per-child check-in, read-only from here) has been
 * gone from this route since M-R2 — this is the control surface itself. A
 * child who wants to tick off a *routine* step still has their own face on
 * the board too (`/hub/routines/[memberId]`, unchanged, and still the
 * larger single-child experience with praise and confetti); this route ticks
 * the same underlying completion, just for the whole household at once, for
 * tasks — a routine step is no longer tapped from here at all (M1+M2).
 */
export default async function HubTakenBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; time?: string }>;
}) {
  const { locale } = await params;
  const { date, time } = await searchParams;
  await requireHubDevice(locale, '/hub/taken', { date, time });

  const composition = await loadHubBoardComposition({ date, time });
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
      data-testid="hub-taken-board"
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
        {/* RoutinesBoard renders its own header (title, date, "Wie" filter, clock), so TodayHeader only renders for the browsed-day fallback. */}
        {board ? (
          <RoutinesBoard board={board} dayKey={dayKey} toggleTaskAction={toggleTaskAction} />
        ) : (
          <>
            <TodayHeader
              surface="hub"
              greeting={t(`hubGreeting.${slot}`)}
              anchor={data.anchor}
              now={data.now}
              timeZone={data.timeZone}
              dayKey={dayKey}
              isToday={isToday}
              members={data.members}
              href="/hub/taken"
            />
            <p className="text-body-sm text-ink-secondary">{t('routines.otherDay')}</p>
          </>
        )}
      </HubBoard>
    </main>
  );
}
