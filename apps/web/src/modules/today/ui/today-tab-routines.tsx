import { getTranslations } from 'next-intl/server';
import { Card } from '@kynite/ui';
import type { KidProgress } from '../page-data';
import { KidStatCard } from './kid-stat-card';

/**
 * "Routines" — how far each child is through today's routine work.
 *
 * One row per child: face, `3 van 5 stappen`, the stars that has earned, and a
 * bar in their own colour. It is a *check-in*, not a control surface — routines
 * are ticked off on the hub and on `/routines`, and a parent tapping a step on
 * their own phone would be doing the child's work for them.
 *
 * Absent for a browsed day rather than wrong on it: today's completions are
 * today's, and a historical read is not what this panel does.
 */

export type TodayTabRoutinesProps = {
  kids: KidProgress[] | null;
};

export async function TodayTabRoutines({ kids }: TodayTabRoutinesProps) {
  const t = await getTranslations('today');

  return (
    <Card data-testid="today-routines" className="gap-4 p-5">
      <h3 className="text-overline text-ink-muted uppercase">{t('routines.title')}</h3>

      {kids === null ? (
        <p className="text-body-sm text-ink-secondary">{t('routines.otherDay')}</p>
      ) : kids.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">{t('kids.empty')}</p>
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(16rem,1fr))]">
          {kids.map((kid) => (
            <KidStatCard
              key={kid.memberId}
              kid={kid}
              size="compact"
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
