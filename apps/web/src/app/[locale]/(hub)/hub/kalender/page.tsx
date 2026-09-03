import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import { TodayHeader, TodayLive, TodayTabPersonen, loadHubBoardComposition } from '@/modules/today';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * "Kalender" — the wall's per-person view (M-R1).
 *
 * One of the four panels `TodayTabs` used to switch between on `/hub`, now its
 * own route: the rail's second destination, for the household's other
 * question — not "what's happening" but "whose day is this". It reads the same
 * composition `/hub` does (`loadHubBoardComposition`, `@/modules/today`) and
 * draws only the one panel this route is for, `TodayTabPersonen` — the day
 * overview, the routine check-in and the star matrix stay on their own routes.
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
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { date, now } = await searchParams;
  await requireHubDevice(locale, '/hub/kalender', { date, now });

  // `TodayTabPersonen` draws no children launcher, task list, weather widget
  // or star progress — none of the four opt-in reads, so `include` is left at
  // its default (all off).
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

  const { data, dayKey, isToday, flow, slot } = composition;
  const nowEventKey = flow.live ? (flow.hero?.key ?? null) : null;

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

        <TodayTabPersonen
          members={data.members}
          events={data.events}
          timeZone={data.timeZone}
          dayKey={dayKey}
          now={data.now}
          isToday={isToday}
          nowEventKey={nowEventKey}
        />
      </HubBoard>
    </main>
  );
}
