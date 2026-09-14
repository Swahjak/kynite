import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { requireHubDevice } from '@/modules/devices';
import { completeStepAction, loadFamilyRoutines, todayKeyIn } from '@/modules/routines';
import { RoutinesPageBoard, TodayLive } from '@/modules/today';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * "Actieve routines" — the family-wide routine page (2026-09-14
 * taken-board-routines-page plan, M3, after
 * `docs/design/claude-design/Actieve routines.dc.html`).
 *
 * Its own page on the wall tablet, separate from `/hub/taken`: one column per
 * family member, the day running top to bottom inside each, the routine that
 * is live standing open with its steps and the finished ones staying in place
 * wearing KLAAR. This is where a routine step is tapped from the household's
 * overview; `/hub/taken` shows only how far along a member's routine is, and
 * `/hub/routines/[memberId]` (untouched) is still one child's own larger
 * screen. All three tick the same completion through the same seam.
 *
 * `?date=`/`?time=` pin the rendered clock so a visual snapshot is
 * deterministic; they affect display only, exactly as on `[memberId]`.
 */
export default async function HubRoutinesOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; time?: string }>;
}) {
  const { locale } = await params;
  const { date, time } = await searchParams;
  await requireHubDevice(locale, '/hub/routines', { date, time });

  const data = await loadFamilyRoutines({ date, time });
  const t = await getTranslations('routines');

  if (!data) {
    return (
      <main className="min-h-full">
        <EmptyState
          size="hub"
          heading
          title={t('hub.unavailableTitle')}
          description={t('hub.unavailableBody')}
        />
      </main>
    );
  }

  return (
    <main
      className="flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-routines-overview"
    >
      <TodayLive />

      <RoutinesPageBoard
        data={data}
        dayKey={todayKeyIn(data.timeZone, data.now)}
        completeStepAction={completeStepAction}
      />
    </main>
  );
}
