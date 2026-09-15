import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { CalendarShell, HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import {
  TodayFilterProvider,
  TodayHeader,
  TodayLive,
  loadHubBoardComposition,
} from '@/modules/today';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * "Kalender" — the wall's per-person calendar (M-R1, hub-calendar-shell).
 *
 * One of the four panels `TodayTabs` used to switch between on `/hub`, now its
 * own route: the rail's second destination, for the household's other
 * question — not "what's happening" but "whose day is this". It reads the same
 * composition `/hub` does (`loadHubBoardComposition`, `@/modules/today`) and
 * renders the parent app's own calendar (`CalendarShell`) with lesser
 * permissions — the owner's 2026-09-14 decision that the hub is the same
 * calendar as `/calendar`, not a second UI. `TodayTabPersonen` — the compact
 * per-person columns — stays the day overview's own panel; the routine
 * check-in and the star matrix stay on their own routes.
 *
 * Mounted the same way `/hub` is (own `TodayHeader`/`TodayLive`/`HubBoard`),
 * rather than nested under it — it is a peer destination in the rail, not a
 * sub-view of the board. (`/hub/store` is a different shape again — no
 * `HubBoard` mirror at all — so it is not the pattern this follows.)
 */
export default async function HubKalenderPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string; date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { view, date, now } = await searchParams;
  await requireHubDevice(locale, '/hub/kalender', { view, date, now });

  // The shell draws its own board, its own view and its own member filter —
  // none of the four opt-in reads (`children`/`progress`/`tasks`/`weather`),
  // so `include` is left at its default (all off).
  const composition = await loadHubBoardComposition({ date, now, view });
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

  return (
    <main
      className="flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-kalender"
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
        <TodayFilterProvider>
          <TodayHeader
            surface="hub"
            greeting={t(`hubGreeting.${slot}`)}
            anchor={data.anchor}
            now={data.now}
            timeZone={data.timeZone}
            dayKey={dayKey}
            isToday={isToday}
            members={data.members}
            href="/hub/kalender"
          />

          <CalendarShell
            surface="hub"
            basePath="/hub/kalender"
            view={data.view}
            anchor={data.anchor}
            events={data.events}
            members={data.members}
            calendars={data.calendars}
            timeZone={data.timeZone}
            weekStartsOn={data.weekStartsOn}
            now={data.now}
            canWrite={data.canWrite}
          />
        </TodayFilterProvider>
      </HubBoard>
    </main>
  );
}
