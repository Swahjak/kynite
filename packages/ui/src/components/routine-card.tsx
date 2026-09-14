'use client';

import { cn } from '../lib/utils';
import { Badge } from './badge';
import { Icon } from './icon';
import type { IconName } from './icon-codepoints';
import { IconMedallion } from './icon-medallion';
import { StarCount } from './star-count';
import { StepRow } from './step-row';

/**
 * A routine on the hub board, in one of its four readings (`Routines.dc.html`).
 *
 * - **Expanded** — the one routine that is live right now, and the only card a
 *   child interacts with. A 6px indigo rail down its left edge, the NU badge
 *   beside the title, a praise line, and the steps as a two-column grid of
 *   tiles. Exactly one card on the board is ever in this state.
 * - **Done** — collapses to a calm success line on the container tone: a green
 *   check, the title, and the stars it paid. Not a trophy and not a score; a
 *   finished routine stops competing for attention with the one that has not
 *   started.
 * - **Grace / graduated** — a quiet white row with a chip on the right saying
 *   which it is. A grace occurrence is an ordinary row that says how long it
 *   still has; nothing marks it as late, because being late is not a failure a
 *   wall display should announce to the household.
 * - **Upcoming** — the same row with the countdown chip.
 *
 * What the card refuses, in every reading: a cross, a colour that means alarm,
 * a badge that reports a miss. A missed routine has no state here at all — it
 * is simply absent, decided one layer up in `loadMemberRoutines`.
 *
 * `data-state` and `data-complete` are the contract the Playwright assertions
 * and the visual snapshot read; the classes are what a family sees.
 */

/**
 * The shape the card draws, stated structurally rather than imported.
 *
 * The app's `BoardRoutine` (`modules/routines/page-data.ts`) carries a good
 * deal more — the occurrence date, the section, the idempotency keys, the
 * counts — none of which this component reads. Restating the read subset here
 * is what lets the package stay ignorant of the routines slice while a
 * `BoardRoutine` still passes straight in: it is structurally assignable, so
 * no call site changed when this moved.
 */
export type RoutineCardStep = {
  id: string;
  title: string;
  done: boolean;
  timerSeconds: number | null;
  /** Selects the praise headline. Resolved to a sentence by `copy.praise`. */
  praiseKey: string;
};

export type RoutineCardRoutine = {
  id: string;
  title: string;
  icon: IconName;
  /** `upcoming` and `grace` are the two collapsed "not now" readings. */
  state: 'upcoming' | 'due' | 'grace' | 'none';
  complete: boolean;
  starsPerCompletion: number;
  steps: readonly RoutineCardStep[];
};

export type RoutineCardProps = {
  routine: RoutineCardRoutine;
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
    /**
     * The expanded card's praise line — "Goed bezig! Nog twee stapjes." Shown
     * only once something has actually been done, because praise for having
     * done nothing yet is not praise.
     */
    praiseLine?: string | null;
    /** The grace row's chip, e.g. "Nog te doen". */
    graceLabel?: string | null;
    /** The disc tint for this routine's icon, e.g. `bg-cat-teal-surface …`. */
    tileClass?: string;
  };
  onComplete?: (stepId: string, origin: { x: number; y: number }) => void;
  /**
   * Makes the card an accordion (`Actieve routines.dc.html`): the header
   * becomes one tap target with a chevron, and the parent decides which card
   * in a column is open. Omitted — the child's own board — the card keeps the
   * non-interactive header it has always had, because there the expansion is
   * decided by the day rather than by a tap.
   */
  onToggle?: () => void;
  /**
   * A single column of steps instead of the two-column grid.
   *
   * The family-wide page draws three-plus columns across 1280px, so a routine
   * card is ~380px wide and the grid's second column would leave two-word
   * tiles. Same component, same tap targets, one column.
   */
  dense?: boolean;
  /**
   * This routine was finished *just now*, on this device (M3's owner ask).
   *
   * Adds the spring to the KLAAR state as it enters, using the design system's
   * own big-pop keyframe — which is already inert under
   * `prefers-reduced-motion`, so there is no second guard here. It is a
   * transition, never a state: the caller only sets it for a routine its own
   * tap completed, so a refresh that re-renders a finished routine does not
   * bounce it again.
   */
  celebrating?: boolean;
};

export function RoutineCard({
  routine,
  expanded,
  copy,
  onComplete,
  onToggle,
  dense = false,
  celebrating = false,
}: RoutineCardProps) {
  // The step the routine is *on*. Presentational only — the board's completion
  // flow is unchanged; this just tells `StepRow` which tile to draw as next.
  const activeStepId = routine.steps.find((step) => !step.done)?.id ?? null;
  const open = expanded && !routine.complete;

  const shared = {
    'data-testid': 'routine-card',
    'data-routine-id': routine.id,
    'data-state': routine.state,
    'data-complete': routine.complete ? 'true' : 'false',
    'data-expanded': open ? 'true' : 'false',
  };

  /* ---------------------------------------------------------------------- */
  /* Done — the quiet success line                                          */
  /* ---------------------------------------------------------------------- */

  if (routine.complete) {
    return (
      <article
        {...shared}
        data-celebrating={celebrating ? 'true' : 'false'}
        className={cn(
          'flex items-center gap-4 rounded-xl bg-surface-container-low px-5 py-4',
          celebrating && 'kynite-anim-pop-big'
        )}
      >
        <Icon name="check_circle" filled size="lg" className="shrink-0 text-cat-green-fg" />
        <h3 className="min-w-0 flex-1 font-display text-h3 font-bold text-ink-secondary">
          {routine.title}
        </h3>
        <p
          data-testid="routine-done-line"
          className="flex shrink-0 items-center gap-1.5 font-display text-body font-bold text-gold-ink"
        >
          <Icon name="star" filled size="sm" />
          <span className="sr-only">{copy.doneLine}</span>
          <span aria-hidden className="tnum">
            +{routine.starsPerCompletion}
          </span>
        </p>
      </article>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Collapsed — grace, graduated, or still ahead                           */
  /* ---------------------------------------------------------------------- */

  if (!open) {
    return (
      <article
        {...shared}
        className={cn(
          'relative flex items-center gap-4 rounded-xl border border-line-subtle bg-surface-container-lowest px-5 py-4',
          onToggle && 'min-h-14'
        )}
      >
        {/* The whole row is the tap target, as a transparent overlay rather
            than a wrapper: the badges and the medallion beside it stay plain
            content, so nothing interactive is nested inside a button. */}
        {onToggle ? (
          <button
            type="button"
            data-testid="routine-toggle"
            aria-expanded={false}
            aria-label={routine.title}
            onClick={onToggle}
            className="absolute inset-0 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        ) : null}

        <IconMedallion
          icon={routine.icon}
          tint={copy.tileClass ? 'none' : 'muted'}
          shape="squircle"
          size="md"
          className={copy.tileClass}
        />

        <div className="min-w-0 flex-1">
          <h3 className="font-display text-h3 font-bold text-balance text-ink">{routine.title}</h3>
          <p className="text-body-sm text-ink-secondary">{copy.stepCount}</p>
        </div>

        {copy.graduated ? (
          <Badge
            data-testid="routine-graduated"
            variant="soft"
            size="md"
            className="shrink-0 bg-accent text-brand-ink"
          >
            <Icon name="workspace_premium" filled size="xs" />
            {copy.graduated}
          </Badge>
        ) : routine.state === 'grace' && copy.graceLabel ? (
          <Badge data-testid="routine-grace" variant="soft" size="md" className="shrink-0">
            <Icon name="schedule" size="xs" />
            {copy.graceLabel}
          </Badge>
        ) : copy.countdown ? (
          <Badge
            data-testid="routine-countdown"
            variant="outline"
            size="md"
            className="tnum shrink-0 border-line-subtle bg-surface-container-lowest text-brand-ink"
          >
            {copy.countdown}
          </Badge>
        ) : null}

        {onToggle ? (
          <Icon name="expand_more" size="lg" className="shrink-0 text-ink-muted" />
        ) : null}
      </article>
    );
  }

  /* ---------------------------------------------------------------------- */
  /* Expanded — the one card a child is standing in front of                */
  /* ---------------------------------------------------------------------- */

  return (
    <article
      {...shared}
      className={cn(
        'relative isolate overflow-hidden rounded-xl border border-line-subtle bg-surface-container-lowest shadow-sm',
        dense ? 'py-4 pr-4 pl-5' : 'py-6 pr-6 pl-7'
      )}
    >
      {/* The rail. Six pixels of indigo down the whole left edge is the board's
          only "this one, now" marker that needs no reading at all. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-primary" />

      <header className={cn('relative flex items-center gap-4', onToggle && 'pr-9')}>
        {onToggle ? (
          <button
            type="button"
            data-testid="routine-toggle"
            aria-expanded
            aria-label={routine.title}
            onClick={onToggle}
            className="absolute -inset-x-2 -inset-y-1 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          />
        ) : null}

        <IconMedallion
          icon={routine.icon}
          tint={copy.tileClass ? 'none' : 'brand-container'}
          shape="squircle"
          size="2xl"
          className={copy.tileClass}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="min-w-0 font-display text-h1 font-extrabold text-balance text-ink">
              {routine.title}
            </h3>
            <Badge
              data-testid="routine-progress"
              variant="status"
              size="md"
              className="label-overline shrink-0"
            >
              {copy.inProgress}
            </Badge>
          </div>
          <p className="text-body text-ink-secondary">{copy.stepCount}</p>
        </div>

        {routine.starsPerCompletion > 0 ? (
          <StarCount
            value={routine.starsPerCompletion}
            srLabel={copy.starLabel(routine.starsPerCompletion)}
            size="lg"
            className="shrink-0"
          />
        ) : null}

        {onToggle ? (
          <Icon
            name="expand_more"
            size="lg"
            className="absolute right-0 shrink-0 rotate-180 text-ink-muted"
          />
        ) : null}
      </header>

      {copy.praiseLine ? (
        <p
          data-testid="routine-praise"
          className="mt-3.5 mb-4.5 flex items-center gap-2.5 rounded-2xl bg-accent px-4 py-2.5 font-display text-body font-bold text-brand-ink"
        >
          <Icon name="celebration" filled size="sm" className="shrink-0" />
          {copy.praiseLine}
        </p>
      ) : null}

      <ul
        className={cn(
          'grid gap-3',
          dense ? undefined : 'sm:grid-cols-2',
          copy.praiseLine ? undefined : 'mt-4.5'
        )}
      >
        {routine.steps.map((step) => (
          <StepRow
            key={step.id}
            variant="tile"
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

      {copy.graduated ? (
        <p data-testid="routine-graduated" className="mt-3 text-caption text-ink-secondary">
          {copy.graduated}
        </p>
      ) : null}
    </article>
  );
}
