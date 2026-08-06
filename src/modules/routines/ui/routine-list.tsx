import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import type { Member } from '@/modules/family';
import { hasGraduated } from '../domain/stars';
import { weekdaysOfRule } from '../domain/schedule';
import type { RoutineWithSteps } from '../queries';
import { DeleteRoutineButton } from './delete-routine-button';
import { GraduateRoutineButton } from './graduate-routine-button';
import { RoutineDialog } from './routine-dialog';
import { routineIconOf } from './tokens';

/**
 * The parent's routine roster.
 *
 * Deliberately *not* a status board: it shows what a routine *is* — whose it
 * is, when it runs, which steps in which order — and never who did or did not
 * do it. Completion belongs to the child's own surface (research §Decisions 3:
 * no screen puts two children's progress side by side).
 */
export async function RoutineList({
  routines,
  members,
  timeZone,
  canWrite,
}: {
  routines: RoutineWithSteps[];
  members: Member[];
  timeZone: string;
  canWrite: boolean;
}) {
  const t = await getTranslations('routines');
  const nameOf = (memberId: string) =>
    members.find((member) => member.id === memberId)?.displayName ?? '';

  if (routines.length === 0) {
    return (
      <p data-testid="routines-empty" className="text-body-lg text-ink-secondary">
        {t('empty')}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {routines.map((routine) => {
        const days = weekdaysOfRule(routine.schedule.rrule, timeZone);

        return (
          <li key={routine.id}>
            <Card data-testid="routine-row" data-routine-id={routine.id}>
              <CardContent className="flex flex-wrap items-start gap-4">
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-ink-secondary"
                >
                  <Icon name={routineIconOf(routine.icon)} size="lg" />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-display text-h3 font-bold">{routine.title}</span>

                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{nameOf(routine.ownerMemberId)}</Badge>
                    <Badge variant="outline">
                      {days.length === 7
                        ? t('schedule.daily')
                        : days.map((day) => t(`weekdays.${day}`)).join(' ')}
                    </Badge>
                    <Badge variant="outline">
                      {routine.schedule.timeOfDay ?? t('schedule.noTime')}
                    </Badge>
                    {(routine.schedule.graceDays ?? 0) > 0 ? (
                      <Badge variant="ghost">
                        {t('schedule.grace', { days: routine.schedule.graceDays ?? 0 })}
                      </Badge>
                    ) : null}
                    {hasGraduated(routine) ? (
                      <Badge variant="ghost" data-testid="routine-graduated-badge">
                        {t('graduated')}
                      </Badge>
                    ) : (
                      <Badge variant="gold">
                        {t('starsPerStep', { count: routine.starsPerCompletion })}
                      </Badge>
                    )}
                  </span>

                  <ol
                    data-testid="routine-steps"
                    className="flex flex-col gap-1 text-body-sm text-ink-secondary"
                  >
                    {routine.steps.map((step, index) => (
                      <li key={step.id} data-testid="routine-step-name">
                        <span className="tabular-time">{index + 1}.</span> {step.title}
                        {step.timerSeconds ? (
                          <span className="ml-2 text-caption">
                            {t('stepTimer', { seconds: step.timerSeconds })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                </div>

                {canWrite ? (
                  <span className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
                    <RoutineDialog members={members} routine={routine} timeZone={timeZone} />
                    <GraduateRoutineButton
                      routineId={routine.id}
                      title={routine.title}
                      graduated={hasGraduated(routine)}
                    />
                    <DeleteRoutineButton routineId={routine.id} title={routine.title} />
                  </span>
                ) : null}
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
