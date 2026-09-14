import { getTranslations } from 'next-intl/server';
import { Card, SectionHeading } from '@kynite/ui';
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
  /**
   * True on the wall (`TodayTabDag`'s `hub` surface), where each card links to
   * `/hub/routines/[memberId]`. That route requires a hub device
   * (`requireHubDevice`), so `(app)/today`'s own routines tab — this same
   * component, unwrapped — leaves the default `false` and stays inert.
   */
  hub?: boolean;
};

export async function TodayTabRoutines({ kids, hub = false }: TodayTabRoutinesProps) {
  const t = await getTranslations('today');

  return (
    <Card data-testid="today-routines" className="gap-4 p-5">
      <SectionHeading title={t('routines.title')} size="card" level={2} />

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
              href={hub ? `/hub/routines/${kid.memberId}` : undefined}
              linkLabel={hub ? t('routines.viewLink', { name: kid.displayName }) : undefined}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
