'use client';

import type { MouseEvent } from 'react';

import { cn } from '../lib/utils';
import { Icon } from './icon';
import { StarPop } from './star-pop';

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
  /**
   * The step this routine is *on* — the first one not yet done (M19).
   *
   * Purely presentational, and additive: the stitch board gives the live step a
   * taller row, a left accent bar and a forward arrow so a glance from across
   * the room lands on "this one next" without reading a word
   * (`chores_routines_light_mode_landscape_hub/code.html`, "Active Step").
   * Every other row keeps the 56px height it always had. Nothing about this
   * marks the rows around it — the ones behind are done, the ones ahead are
   * ordinary, and neither carries a status.
   */
  active?: boolean;
  /**
   * `row` is the full-width single-tap row this component has always been.
   * `tile` is the design sheets' two-column grid cell inside an expanded
   * routine card (`Routines.dc.html`): a bordered 80px tile that turns green
   * and strikes its own title through once it is done.
   *
   * The praise line and the star survive the change of shape. The sheet draws
   * the finished tile as a struck-through title alone, but praise-before-star
   * is a product rule (FR15) rather than a layout preference — a step that pays
   * a star says which star it paid, and it says the sentence first. So the tile
   * carries both, at caption scale under the title, which is the smallest place
   * they can honestly go.
   */
  variant?: 'row' | 'tile';
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
  active = false,
  variant = 'row',
  onComplete,
}: StepRowProps) {
  const live = active && !done;

  /** Shared by both shapes: one tap, no confirmation, no second fire. */
  const tap = (event: MouseEvent<HTMLButtonElement>) => {
    if (done || !onComplete) return;
    const box = event.currentTarget.getBoundingClientRect();
    onComplete({
      x: (box.left + box.width / 2) / Math.max(window.innerWidth, 1),
      y: (box.top + box.height / 2) / Math.max(window.innerHeight, 1),
    });
  };

  if (variant === 'tile') {
    return (
      <li data-testid="routine-step" data-step-id={stepId} data-state={done ? 'done' : 'todo'}>
        <button
          type="button"
          data-testid="step-tap"
          aria-label={actionLabel}
          aria-pressed={done}
          onClick={tap}
          className={cn(
            'flex min-h-20 w-full items-center gap-3.5 rounded-[18px] border-2 px-4.5 py-4 text-left transition-all duration-200 ease-brand',
            'focus-visible:ring-3 focus-visible:ring-ring/50',
            done
              ? 'border-cat-green-border bg-cat-green-surface'
              : 'border-line bg-background hover:bg-surface-container active:scale-[0.99]'
          )}
        >
          {/* A done step is a green check; one still to do is an empty ring.
              Never a cross, and nothing at all on the tiles around it. */}
          <Icon
            name={done ? 'check_circle' : 'radio_button_unchecked'}
            filled={done}
            size="lg"
            className={cn('shrink-0', done ? 'text-cat-green-fg kynite-anim-check' : 'text-line')}
          />

          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                'font-display text-h3 leading-tight font-bold text-balance',
                done && 'text-ink-secondary line-through decoration-cat-green-border'
              )}
            >
              {title}
            </span>

            {done ? (
              <span className="flex items-center gap-2">
                {/* Headline first, star after — FR15, in the smallest shape the
                    tile allows. */}
                <span
                  data-testid="step-praise"
                  className="min-w-0 font-display text-caption leading-snug font-bold text-brand-ink"
                >
                  {praiseText}
                </span>
                <span data-testid="step-star" className="shrink-0">
                  <StarPop amount={stars} label={starLabel} />
                </span>
              </span>
            ) : null}
          </span>

          {!done && timerSeconds ? (
            <span className="flex shrink-0 items-center gap-1 rounded-4xl bg-surface-container px-3 py-1 font-display text-caption font-bold text-ink-secondary">
              <Icon name="timer" size="sm" />
              <span className="tabular-time">{formatTimer(timerSeconds)}</span>
            </span>
          ) : null}
        </button>
      </li>
    );
  }

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
        onClick={tap}
        className={cn(
          // 56px — the Stitch hub step-row height, well past the 48px kiosk
          // minimum, because this is the one control that matters here. The
          // live step steps up to 72px, which is the mockup's only size change.
          'group/step relative flex w-full items-center gap-4 overflow-hidden rounded-xl px-4 text-left transition-all duration-200 ease-brand',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
          live ? 'h-18' : 'h-14',
          // The "done" dim is decorative, but `opacity` applies to the text
          // inside the row as well — and a done step carries the star award in
          // `--gold-ink`, the darkest-tinted label on the row (6.49:1 on white).
          // At 80% it composited to 3.86:1 on the hub board and took the
          // routines surface under AA (M19). 90% keeps the recede the mockup
          // asks for and leaves every label on the row above 4.5:1.
          done && 'bg-surface-container-low opacity-90 hover:opacity-100',
          live && 'border-l-4 border-primary bg-primary/8 shadow-sm hover:bg-primary/12',
          !done && !live && 'bg-surface-container-lowest shadow-sm hover:bg-surface-hover',
          !done && 'active:scale-[0.99]'
        )}
      >
        {/* Selection controls (components.md § Selection controls): checkbox
            off = 24px, radius 6px, 2px solid border; on = 24px, radius 6px,
            #006056 (teal / `bg-success`) fill, white 16px check. The row keeps
            its own size step for the live/next step (40px vs 32px) — that is
            this board's own "what's next" affordance, not part of the
            checkbox spec — but the shape and the checked colour now match the
            doc exactly, including the check-pop motion from motion.md
            § "Checkbox pop" (`.kynite-anim-check`).
            Not `ui/checkbox.tsx` (the shared primitive `routine-dialog.tsx`'s
            reward toggle now uses): this glyph is `aria-hidden` decoration
            inside a `<button>` that is *itself* the whole tap target — the
            entire row already carries `aria-pressed`. Base UI's `Checkbox`
            is its own interactive control with a hidden native `<input>`;
            nesting one inside this button would add a second, invalid,
            interactive descendant and a duplicate keyboard target for a
            state this row already reports. */}
        <span
          aria-hidden
          className={cn(
            'flex shrink-0 items-center justify-center rounded-sm transition-colors duration-200',
            live ? 'size-10' : 'size-8',
            done && 'bg-success',
            live && !done && 'border-2 border-primary bg-surface-container-lowest',
            !done && !live && 'border-2 border-line'
          )}
        >
          {done ? (
            <Icon name="check" size="sm" filled className="text-white kynite-anim-check" />
          ) : null}
        </span>

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            live ? 'font-display text-h3 font-semibold' : 'text-body-lg',
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
        ) : (
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {timerSeconds ? (
              <span className="flex items-center gap-1 rounded-4xl bg-surface-container px-3 py-1 text-caption text-ink-secondary">
                <Icon name="timer" size="sm" />
                <span className="tabular-time">{formatTimer(timerSeconds)}</span>
              </span>
            ) : null}
            {/* The mockup's forward arrow on the live row. Direction, not a
                verdict: it points at what happens next and says nothing about
                the rows behind it. */}
            {live ? (
              <Icon
                name="arrow_forward"
                size="lg"
                className="text-ink-secondary transition-transform duration-200 ease-brand group-hover/step:translate-x-1"
              />
            ) : null}
          </span>
        )}
      </button>
    </li>
  );
}
