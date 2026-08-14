import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { MemberAvatar } from '@/modules/family';
import { completeStepAction, undoCompletionAction } from '@/modules/routines';
import type { KidProgress } from '../page-data';
import { KidStatCard } from './kid-stat-card';
import { StarMatrix } from './star-matrix';

/**
 * "Sterren vandaag" — today's stars, per child
 * (`docs/design/vandaag-template.html`, the `isSterren` panel).
 *
 * Two columns, and they answer two different questions. The matrix on the left
 * is *which* steps happened, as a grid of steps × children a parent can tick
 * from their own phone — the correction path for "she did feed the cat, she
 * just never tapped it". The stack on the right is *how the day is going*, the
 * same stat block the routines tab draws, at full size.
 *
 * Only children with steps today get a column, because a column of em-dashes
 * says nothing; a child with no routines today still gets their stat card, so
 * the panel does not quietly lose a member of the family.
 *
 * Absent for a browsed day rather than wrong on it: today's completions are
 * today's, and the matrix writes — a grid that ticked yesterday's step would be
 * offering to change history.
 */

export type TodayTabSterrenProps = {
  kids: KidProgress[] | null;
};

export async function TodayTabSterren({ kids }: TodayTabSterrenProps) {
  const t = await getTranslations('today');

  if (kids === null || kids.length === 0) {
    return (
      <Card data-testid="today-stars" className="gap-5 p-5 sm:p-6">
        <h3 className="font-display text-h3 font-bold">{t('stars.title')}</h3>
        <p className="text-body-sm text-ink-secondary">
          {kids === null ? t('stars.otherDay') : t('kids.empty')}
        </p>
      </Card>
    );
  }

  /**
   * The grid's columns, assembled here rather than inside it.
   *
   * `StarMatrix` runs in the browser, and neither the family slice's avatar nor
   * the routines slice's actions can be imported from there — both barrels
   * carry `server-only` reads (see the note in that file). So the face is
   * rendered on the server and the two actions are passed by reference.
   */
  const columns = kids
    .filter((kid) => kid.steps.length > 0)
    .map((kid) => ({
      memberId: kid.memberId,
      displayName: kid.displayName,
      steps: kid.steps,
      avatar: (
        <MemberAvatar
          displayName={kid.displayName}
          avatarUrl={kid.avatarUrl}
          color={kid.color}
          size="sm"
        />
      ),
    }));

  return (
    <div
      data-testid="today-stars"
      className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]"
      // Below `lg` the two columns stack; the matrix keeps its own horizontal
      // scroll inside the card, so the page never scrolls sideways.
    >
      <Card data-testid="today-stars-matrix" className="gap-5 p-5 sm:p-6">
        <h3 className="font-display text-h3 font-bold">{t('stars.title')}</h3>
        <StarMatrix
          columns={columns}
          completeStep={completeStepAction}
          undoCompletion={undoCompletionAction}
        />
      </Card>

      <div className="flex flex-col gap-4">
        {kids.map((kid) => (
          <Card key={kid.memberId} className="p-4 sm:p-5">
            <KidStatCard
              kid={kid}
              stepsLabel={
                kid.totalSteps === 0
                  ? t('kids.noRoutines')
                  : t('routines.steps', { done: kid.doneSteps, total: kid.totalSteps })
              }
              starsLabel={t('kids.starsToday', { count: kid.starsToday })}
              progressLabel={t('routines.progressLabel', { name: kid.displayName })}
            />
          </Card>
        ))}
      </div>
    </div>
  );
}
