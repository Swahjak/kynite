'use client';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { BoardRoutine } from '../page-data';
import { StepRow } from './step-row';

/**
 * A routine on the hub board, in one of its three readings.
 *
 * - **Expanded** — the routine that is live right now. Its steps are 56px
 *   single-tap rows; this is the only card a child interacts with.
 * - **Done** — collapses to a calm success line. Not a trophy, not a score:
 *   one sentence and a quiet icon, so a finished routine stops competing for
 *   attention with the one that has not started.
 * - **Dimmed** — either still ahead (with a countdown chip) or an occurrence
 *   from an earlier day still inside its grace window. Both use the *same*
 *   neutral dimming, and neither carries a mark, a colour change or a word
 *   about being late (research §Decisions 1 and 2).
 *
 * `data-state` and `data-complete` are the contract the Playwright assertions
 * and the visual snapshot read; the classes are what a family sees.
 */

export type RoutineCardProps = {
  routine: BoardRoutine;
  expanded: boolean;
  /** Translated copy, resolved by the board so this stays presentational. */
  copy: {
    stepCount: string;
    inProgress: string;
    doneLine: string;
    countdown: string | null;
    starLabel: (amount: number) => string;
    actionLabel: (title: string) => string;
    praise: (praiseKey: string) => string;
    graduated: string | null;
  };
  onComplete?: (stepId: string, origin: { x: number; y: number }) => void;
};

export function RoutineCard({ routine, expanded, copy, onComplete }: RoutineCardProps) {
  const dimmed = !expanded && (routine.state === 'upcoming' || routine.state === 'grace');
  // The step the routine is *on*. Presentational only — the board's completion
  // flow is unchanged; this just tells `StepRow` which row to draw large.
  const activeStepId = routine.steps.find((step) => !step.done)?.id ?? null;

  return (
    <article
      data-testid="routine-card"
      data-routine-id={routine.id}
      data-state={routine.state}
      data-complete={routine.complete ? 'true' : 'false'}
      data-expanded={expanded ? 'true' : 'false'}
      className={cn(
        'relative isolate overflow-hidden rounded-xl bg-surface-container-lowest transition-all duration-200 ease-brand',
        expanded ? 'p-6 shadow-md hover:shadow-lg' : 'p-4 shadow-sm hover:shadow-md',
        // The dimmed treatment. One opacity, no colour, no border, no icon —
        // "missed" and "not yet" look the same because neither is a failure.
        dimmed && 'opacity-60 hover:opacity-100'
      )}
    >
      {/* The faint glow the mockup paints behind the live card
          (`chores_routines_…/code.html`: a blurred `primary-container/20`
          quarter-circle in the top-right). Ambience, not a status marker —
          only the expanded card has it, and it carries no information the
          `IN PROGRESS` pill does not already carry in words. */}
      {expanded ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 -z-10 size-40 rounded-full bg-primary/15 blur-3xl"
        />
      ) : null}

      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-200',
            expanded
              ? 'bg-brand-container text-brand-container-ink'
              : 'bg-surface-container text-ink-secondary'
          )}
        >
          <Icon name={routine.icon} size="lg" filled={expanded} />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-h3 font-bold text-foreground">
            {routine.title}
          </h3>
          {routine.complete ? (
            <p
              data-testid="routine-done-line"
              className="flex items-center gap-1 text-body-sm text-brand-ink"
            >
              <Icon name="star" size="sm" filled />
              {copy.doneLine}
            </p>
          ) : (
            <p className="truncate text-body-sm text-ink-secondary">{copy.stepCount}</p>
          )}
        </div>

        {routine.complete ? (
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-container text-brand-container-ink"
          >
            {/* `celebration`, per the mockup's finished-routine medallion. Still
                one quiet glyph on a collapsed card — the celebration itself
                happened at the tap. */}
            <Icon name="celebration" size="lg" filled />
          </span>
        ) : copy.countdown ? (
          <span
            data-testid="routine-countdown"
            className="flex shrink-0 items-center gap-1 rounded-4xl bg-surface-container px-3 py-1 text-caption text-ink-secondary"
          >
            <Icon name="schedule" size="xs" />
            {copy.countdown}
          </span>
        ) : expanded ? (
          <span
            data-testid="routine-progress"
            className="label-overline shrink-0 rounded-4xl bg-brand-container px-4 py-1.5 text-brand-container-ink"
          >
            {copy.inProgress}
          </span>
        ) : null}
      </header>

      {expanded && !routine.complete ? (
        <ul className="mt-6 flex flex-col gap-3">
          {routine.steps.map((step) => (
            <StepRow
              key={step.id}
              stepId={step.id}
              title={step.title}
              done={step.done}
              timerSeconds={step.timerSeconds}
              praiseText={copy.praise(step.praiseKey)}
              stars={routine.starsPerCompletion}
              starLabel={copy.starLabel(routine.starsPerCompletion)}
              actionLabel={copy.actionLabel(step.title)}
              active={step.id === activeStepId}
              onComplete={onComplete ? (origin) => onComplete(step.id, origin) : undefined}
            />
          ))}
        </ul>
      ) : null}

      {/* The fade path's whole UI at M07: a quiet badge, never a downgrade.
          M08 owns the full graduation surface. */}
      {copy.graduated ? (
        <p data-testid="routine-graduated" className="mt-3 text-caption text-ink-secondary">
          {copy.graduated}
        </p>
      ) : null}
    </article>
  );
}
