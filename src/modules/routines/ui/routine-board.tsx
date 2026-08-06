'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fireConfettiBurst } from '@/components/celebration';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { completeStepAction } from '../actions';
import type { BoardRoutine, RoutineBoard as RoutineBoardData } from '../page-data';
import { RoutineCard } from './routine-card';
import { SECTION_ICONS } from './tokens';

/**
 * The child-facing hub board (M07's `(hub)/routines/[memberId]`).
 *
 * This component owns the client half of the <100ms optimistic completion flow
 * (docs/architecture.md §4):
 *
 * ```
 * tap ─ local state flips to done ─ confetti + praise fire ─ Server Action
 * ```
 *
 * in that order, with **no await before the flip and no spinner anywhere**.
 * `pending` from `useTransition` is deliberately not destructured: there is no
 * loading state to render, because the child has already seen the result.
 *
 * Failure is equally deliberate. Nothing here rolls a celebration back — the
 * write is idempotent (`clientId`) and will land; if it truly does not, the
 * next server render simply shows the step as not-done, quietly. A child never
 * sees an animation reversed.
 *
 * Realtime lands in M10. Until then the Server Action revalidates the board's
 * own path, and `publish()` is already called inside the completion
 * transaction — so the stream, when it arrives, replaces the refresh rather
 * than adding a call site.
 */

export function RoutineBoard({ board }: { board: RoutineBoardData }) {
  const t = useTranslations('routines');

  const [optimisticDone, addOptimisticDone] = useOptimistic<ReadonlySet<string>, string>(
    new Set<string>(),
    (previous, stepId) => new Set(previous).add(stepId)
  );
  const [, startTransition] = useTransition();

  /** The board with optimistic completions folded in — one source for render. */
  const withOptimistic = (routine: BoardRoutine): BoardRoutine => {
    if (optimisticDone.size === 0) return routine;

    const steps = routine.steps.map((step) =>
      step.done || !optimisticDone.has(step.id) ? step : { ...step, done: true }
    );
    const doneCount = steps.filter((step) => step.done).length;

    return {
      ...routine,
      steps,
      doneCount,
      complete: steps.length > 0 && doneCount === steps.length,
      ratio: steps.length === 0 ? 0 : doneCount / steps.length,
    };
  };

  const complete = (routine: BoardRoutine, stepId: string, origin: { x: number; y: number }) => {
    const step = routine.steps.find((entry) => entry.id === stepId);
    if (!step || step.done) return;

    // Finishing the last step of a routine is a bigger moment than finishing
    // one of four — but only one step up the intensity dial, never a different
    // kind of animation that would make the everyday tap feel unrewarded.
    const lastStep = routine.steps.every((entry) => entry.done || entry.id === stepId);

    startTransition(async () => {
      addOptimisticDone(stepId);
      fireConfettiBurst({ intensity: lastStep ? 'standard' : 'gentle', origin });

      await completeStepAction({
        routineId: routine.id,
        routineStepId: stepId,
        memberId: routine.memberId,
        occurrenceDate: routine.occurrenceDate,
        clientId: step.clientId,
        source: 'hub',
      });
    });
  };

  const copyFor = (routine: BoardRoutine) => ({
    stepCount: t('stepCount', { count: routine.total }),
    inProgress: t('inProgress'),
    doneLine: t(`routineDone.${routine.doneKey}`, { name: board.member.displayName }),
    // Minutes are only meaningful close in; "starts in 705 min" is noise on a
    // board a child glances at.
    countdown:
      routine.state === 'upcoming' && routine.minutesUntil !== null
        ? routine.minutesUntil <= 90
          ? t('startsIn', { minutes: routine.minutesUntil })
          : t('startsInHours', { hours: Math.round(routine.minutesUntil / 60) })
        : null,
    starLabel: (amount: number) => t('starsEarned', { count: amount }),
    actionLabel: (title: string) => t('completeStep', { title }),
    praise: (praiseKey: string) => t(`praise.${praiseKey}`),
    graduated: routine.graduated ? t('graduated') : null,
  });

  const anythingToShow = board.sections.some((section) => section.routines.length > 0);

  return (
    <div data-testid="routine-board" className="flex flex-col gap-8">
      {board.sections.map((section) => (
        <section key={section.section} data-testid={`routine-section-${section.section}`}>
          <div className="mb-4 flex items-center gap-4">
            <h2 className="flex items-center gap-2 font-display text-h2 font-bold text-foreground">
              <Icon name={SECTION_ICONS[section.section]} size="lg" filled />
              {t(`sections.${section.section}`)}
            </h2>

            {/* Neutral board voice: "3 of 4 done", never "you still have to…". */}
            <span
              data-testid={`section-progress-${section.section}`}
              className="text-body-sm text-ink-secondary"
            >
              {t('sectionProgress', { done: section.doneCount, total: section.total })}
            </span>

            <span
              aria-hidden
              className="ml-auto h-1 w-24 overflow-hidden rounded-full bg-muted sm:w-48"
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-500 ease-brand"
                style={{ width: `${Math.round(section.ratio * 100)}%` }}
              />
            </span>
          </div>

          {section.routines.length === 0 ? (
            <p className={cn('text-body text-ink-muted')}>{t('sectionEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-4">
              {section.routines.map((raw) => {
                const routine = withOptimistic(raw);
                const expanded = routine.id === board.activeRoutineId && !routine.complete;

                return (
                  <RoutineCard
                    key={routine.id}
                    routine={routine}
                    expanded={expanded}
                    copy={copyFor(routine)}
                    onComplete={(stepId, origin) => complete(routine, stepId, origin)}
                  />
                );
              })}
            </div>
          )}
        </section>
      ))}

      {anythingToShow ? null : (
        <p data-testid="routine-board-empty" className="text-body-lg text-ink-secondary">
          {t('boardEmpty')}
        </p>
      )}
    </div>
  );
}
