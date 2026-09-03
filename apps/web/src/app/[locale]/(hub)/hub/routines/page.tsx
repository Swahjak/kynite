import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import { TodayHeader, TodayLive, TodayTabRoutines, loadHubBoardComposition } from '@/modules/today';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * "Taken & routines" — the household's check-in, one row per child (M-R1).
 *
 * A placeholder in the sense that M-R2 gives this rail destination its own
 * board (per-child routine control, not just a check-in) — but the rail item
 * has to point somewhere real today rather than at a route that 404s, so this
 * mounts the same `TodayTabRoutines` panel `/hub` used to carry as one of its
 * four tabs, on the shared `loadHubBoardComposition` read. A child who wants
 * to *tick off* a step still goes to their own face on the board
 * (`/hub/routines/[memberId]`, unchanged) — this route is the overview, not a
 * second way to complete a step.
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

  // `TodayTabRoutines` needs the kids' progress read; it draws no children
  // launcher, task list or weather widget, so the other three opt-in reads
  // stay off. M-R2's routine board will need `children` and `tasks` too the
  // moment this route stops being a check-in and starts letting a child tick
  // a step off from here — add them to `include` then.
  const composition = await loadHubBoardComposition({
    date,
    now,
    include: { progress: true },
  });
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

  const { data, dayKey, isToday, progress, slot } = composition;

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

        <TodayTabRoutines kids={progress?.kids ?? null} />
      </HubBoard>
    </main>
  );
}
