import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import type { KidProgress } from '../page-data';
import { KidStatCard } from './kid-stat-card';

/**
 * "Sterren vandaag" — today's stars, per child.
 *
 * The mockup's version of this tab is a matrix: routine steps down the left,
 * one column per child, a filled star or an empty circle in every cell, tappable
 * to tick a step off from a parent's phone. That grid needs each child's *steps*
 * for today rather than their totals, and it writes — so it is being built
 * separately.
 *
 * What ships here is the honest half of it: the same per-child stat block the
 * routines tab draws, at full size, stating exactly the two numbers this page
 * already knows. It is not a placeholder in the sense of a gap — a parent
 * opening this tab today gets a true answer to "how did the stars go" — it is
 * simply the summary without the grid.
 */

export type TodayTabSterrenProps = {
  kids: KidProgress[] | null;
};

export async function TodayTabSterren({ kids }: TodayTabSterrenProps) {
  const t = await getTranslations('today');

  return (
    <Card data-testid="today-stars" className="gap-5 p-5 sm:p-6">
      <h3 className="font-display text-h3 font-bold">{t('stars.title')}</h3>

      {kids === null ? (
        <p className="text-body-sm text-ink-secondary">{t('stars.otherDay')}</p>
      ) : kids.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">{t('kids.empty')}</p>
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(18rem,1fr))]">
          {kids.map((kid) => (
            <KidStatCard
              key={kid.memberId}
              kid={kid}
              className="rounded-2xl bg-surface-container-low p-4"
              stepsLabel={
                kid.totalSteps === 0
                  ? t('kids.noRoutines')
                  : t('routines.steps', { done: kid.doneSteps, total: kid.totalSteps })
              }
              starsLabel={t('kids.starsToday', { count: kid.starsToday })}
              progressLabel={t('routines.progressLabel', { name: kid.displayName })}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
