import { getTranslations } from 'next-intl/server';
import { StarChart, loadStarChart } from '@/modules/rewards';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * One child's star chart on the hub (M08).
 *
 * The `[memberId]` in the path is not a filter over a shared screen — it is
 * the whole screen. There is no `/hub/stars` index that lists everyone, and
 * `loadStarChart` takes exactly one member id, so "show both children's totals"
 * is not a thing this route can be asked for (research §Decisions 3).
 *
 * `?date=` pins the week window so the visual snapshot is deterministic;
 * display only, like every other pinned surface in this app.
 */
export default async function HubStarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { memberId } = await params;
  const { date } = await searchParams;

  const chart = await loadStarChart({ memberId, date });
  const t = await getTranslations('rewards');

  if (!chart) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('chart.unavailableTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('chart.unavailableBody')}</p>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-dvh flex-col gap-6 bg-background p-6"
      data-testid="hub-stars"
      data-member-id={chart.member.id}
    >
      <header>
        <h1 className="font-display text-display-md font-extrabold">
          {t('chart.title', { name: chart.member.displayName })}
        </h1>
        <p className="text-body-lg text-ink-secondary">{t('chart.subtitle')}</p>
      </header>

      <StarChart chart={chart} />
    </main>
  );
}
