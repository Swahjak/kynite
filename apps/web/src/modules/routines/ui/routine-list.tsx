import { getTranslations } from 'next-intl/server';
import { Badge, Card, CardContent } from '@kynite/ui';
import { IconMedallion, StarCount } from '@/components/kynite';
import { formatDateTime } from '@/i18n/formatting-locale';
import { getHouseholdFormattingLocale, type Member } from '@/modules/family';
import { hasGraduated } from '../domain/stars';
import { oneOffDateOf, weekdaysOfRule } from '../domain/schedule';
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
  const formattingLocale = await getHouseholdFormattingLocale();
  /**
   * A date key rendered in the reader's locale. Noon UTC, not midnight: the
   * key already *is* the family's calendar day, and reading it back at midnight
   * would let any zone west of UTC render the day before.
   */
  const dayOf = (dateKey: string) =>
    formatDateTime(new Date(`${dateKey}T12:00:00Z`), formattingLocale, {
      day: 'numeric',
      month: 'long',
    });
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
    // A card grid, not a stack of full-width rows (docs/rebuild-design-gaps.md
    // §5): the roster answers "what routines exist" at a glance, and the
    // mockups render every catalogue as a grid of tiles.
    <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {routines.map((routine) => {
        const days = weekdaysOfRule(routine.schedule.rrule, timeZone);
        const onceDate = oneOffDateOf(routine.schedule);

        return (
          <li key={routine.id} className="flex">
            <Card
              data-testid="routine-row"
              data-routine-id={routine.id}
              className="w-full transition-shadow duration-200 ease-brand hover:shadow-md"
            >
              <CardContent className="flex flex-wrap items-start gap-4">
                <IconMedallion
                  icon={routineIconOf(routine.icon)}
                  filled
                  tint="brand-container"
                  shape="circle"
                  size="lg"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="font-display text-h3 font-bold">{routine.title}</span>

                  <span className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{nameOf(routine.ownerMemberId)}</Badge>
                    <Badge variant="outline" data-testid="routine-schedule-badge">
                      {onceDate
                        ? t('schedule.once', { date: dayOf(onceDate) })
                        : days.length === 7
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
                      <StarCount
                        value={routine.starsPerCompletion}
                        srLabel={t('starsPerStep', { count: routine.starsPerCompletion })}
                      />
                    )}
                  </span>

                  {/* The step list is the routine, so it reads as an ordered
                      list of rows rather than a paragraph of run-together
                      text: a numbered medallion, the title, and the timer
                      prescription as a chip on the right. */}
                  <ol data-testid="routine-steps" className="flex flex-col gap-1">
                    {routine.steps.map((step, index) => (
                      <li
                        key={step.id}
                        data-testid="routine-step-name"
                        className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm"
                      >
                        <span
                          aria-hidden
                          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-caption font-bold text-ink-secondary tabular-time"
                        >
                          {index + 1}
                        </span>
                        {/* Wrapping, not clipping: a step title is an
                            instruction, and half of one ("Tanden poetsen en
                            dan…") is not a shorter instruction. Two lines
                            keeps the row list scannable. */}
                        <span className="line-clamp-2 min-w-0 flex-1">{step.title}</span>
                        {step.timerSeconds ? (
                          <span className="shrink-0 rounded-4xl bg-surface-container px-2 py-0.5 text-caption text-ink-secondary">
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
