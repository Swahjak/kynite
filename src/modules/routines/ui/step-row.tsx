'use client';

import { StarPop } from '@/components/celebration';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * One routine step: the single control a child uses (FR8, research §"Yoto/
 * Tonies" — one large tap, no menus).
 *
 * Everything about this component is one decision repeated:
 *
 * - **One tap, no confirmation, no spinner.** The whole row is the button.
 *   There is no dialog to dismiss and no pending state to render, because the
 *   parent flips it optimistically before the request leaves the device (§4).
 * - **Praise is the headline, the star is secondary** (FR15). The praise line
 *   is rendered *first in the DOM* and at heading scale; the star follows it,
 *   at caption scale. That order is asserted by a DOM-order test and pinned by
 *   a visual snapshot, so it cannot drift.
 * - **Nothing marks anything.** A step that is not done carries an empty
 *   outline, not a cross; a step from an earlier grace day is dimmed by its
 *   card, not annotated here.
 *
 * Presentational on purpose — it takes translated strings rather than calling
 * `useTranslations`, which is what lets the DOM-order test render it without a
 * locale provider and assert the *component's* contract rather than i18n's.
 */

export type StepRowProps = {
  stepId: string;
  title: string;
  done: boolean;
  timerSeconds: number | null;
  /** Competence-signalling praise, already translated. Shown once done. */
  praiseText: string;
  /** Stars this step paid. 0 for a graduated routine — then nothing renders. */
  stars: number;
  starLabel: string;
  /** Accessible name of the tap target, e.g. "Mark Brush teeth as done". */
  actionLabel: string;
  onComplete?: (origin: { x: number; y: number }) => void;
};

/** `90` → `1:30`. Untimed steps show nothing rather than a zero. */
function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function StepRow({
  stepId,
  title,
  done,
  timerSeconds,
  praiseText,
  stars,
  starLabel,
  actionLabel,
  onComplete,
}: StepRowProps) {
  return (
    <li data-testid="routine-step" data-step-id={stepId} data-state={done ? 'done' : 'todo'}>
      <button
        type="button"
        data-testid="step-tap"
        aria-label={actionLabel}
        aria-pressed={done}
        // A completed step is not re-tappable, but it is not *disabled* either:
        // it keeps its accessible name and stays in the tab order so the board
        // reads as a list of what happened, not a list of dead controls.
        onClick={(event) => {
          if (done || !onComplete) return;
          const box = event.currentTarget.getBoundingClientRect();
          onComplete({
            x: (box.left + box.width / 2) / Math.max(window.innerWidth, 1),
            y: (box.top + box.height / 2) / Math.max(window.innerHeight, 1),
          });
        }}
        className={cn(
          // 56px — the Stitch hub step-row height, well past the 48px kiosk
          // minimum, because this is the one control that matters here.
          'flex h-14 w-full items-center gap-4 rounded-lg px-4 text-left transition-all duration-200 ease-brand',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          done
            ? 'bg-surface-hover'
            : 'bg-surface ring-1 ring-foreground/10 hover:bg-accent active:scale-[0.99]'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            done ? 'bg-primary text-primary-foreground' : 'ring-2 ring-line'
          )}
        >
          {done ? <Icon name="check" size="sm" filled /> : null}
        </span>

        <span
          className={cn(
            'min-w-0 flex-1 truncate text-body-lg',
            done && 'text-ink-secondary line-through decoration-ink-muted/50'
          )}
        >
          {title}
        </span>

        {done ? (
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {/* Headline. First in the DOM and the largest thing in the row. */}
            <span
              data-testid="step-praise"
              className="font-display text-h3 font-bold text-brand-ink"
            >
              {praiseText}
            </span>
            {/* Secondary. Follows the praise, at caption scale. */}
            <span data-testid="step-star">
              <StarPop amount={stars} label={starLabel} />
            </span>
          </span>
        ) : timerSeconds ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 text-caption text-ink-secondary">
            <Icon name="timer" size="sm" />
            <span className="tabular-time">{formatTimer(timerSeconds)}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}
