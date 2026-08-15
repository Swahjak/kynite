'use client';

import { Badge, Button, cn, Icon } from '@kynite/ui';
import { IconMedallion, ProgressBar } from '@/components/kynite';
import {
  formatCountdown,
  isWarningDue,
  phaseOf,
  progressRatio,
  remainingSeconds,
} from '../domain/countdown';
import type { TimerView } from '../page-data';
import {
  COUNTDOWN_DIGIT_CLASS,
  COUNTDOWN_DIGIT_CLASS_COMPACT,
  OVERRUN_PULSE_STYLE,
  TIMER_TAP_TARGET_CLASS,
} from './tokens';

/**
 * One countdown, as the board draws it.
 *
 * Presentational on purpose — it takes already-translated strings and an
 * already-corrected `nowMs` rather than reaching for `useTranslations` or
 * `Date.now()`. That is what lets a test render it at any instant and assert
 * the *component's* contract, and it keeps the "which clock is authoritative"
 * decision in exactly one place (`useTimerChannel` → `useServerNow`).
 *
 * Two things it deliberately does not do:
 *
 * - **It never marks the overrun.** A timer that ran out is not late, wrong or
 *   failed; the board states that the time is up, in the same colours it used a
 *   second earlier, and breathes once every 2.4s so a glance still finds it.
 *   No red, no alarm iconography, no flash (research §Decisions 1; the pulse is
 *   bounded by `isNonStrobing`).
 * - **It never addresses anyone.** The label is the thing, not the person:
 *   "Schoenen aan — over 5 minuten", never "doe je schoenen aan" (FR30).
 */

export type TimerTileCopy = {
  /** "Schoenen aan over 5 minuten" — shown only while the warning is live. */
  warning: string | null;
  /** Neutral end-state line, e.g. "Tijd is om". */
  overrun: string;
  /** Accessible name for the countdown, e.g. "Nog 4 minuten 30 seconden". */
  remainingLabel: string;
  /** Accessible name of the stop control. Omitted when there is no control. */
  stopLabel?: string;
  /**
   * Stated when `extendTimerAction` answers `atMaximum` (M18, surfaced in M19):
   * the timer is already as long as a timer gets. A fact about the clock, not
   * a refusal — see `atMaximum` below.
   */
  atMaximum?: string;
};

/**
 * One "a bit longer" control (M18, FR7). Already-translated, like everything
 * else this component takes — the tile renders, it does not look copy up.
 */
export type TimerExtendOption = {
  minutes: number;
  /** Short face of the button, e.g. "+5 min". */
  label: string;
  /** The full sentence a screen reader gets. */
  ariaLabel: string;
};

export type TimerTileProps = {
  timer: TimerView;
  nowMs: number;
  copy: TimerTileCopy;
  compact?: boolean;
  onStop?: () => void;
  /**
   * "A bit longer" (M18). Absent, the tile renders exactly as it did before —
   * a surface that cannot control timers passes neither this nor `onStop`.
   */
  extendOptions?: readonly TimerExtendOption[];
  onExtend?: (minutes: number) => void;
  /**
   * The timer is at `MAX_DURATION_SECONDS` (M18's `atMaximum`, wired to the UI
   * in M19). The extend controls come off and the tile states why, once, in
   * the same ink as everything else: nothing is disabled-looking, nothing is
   * marked, and the child is not left tapping a button that answers nothing.
   */
  atMaximum?: boolean;
};

export function TimerTile({
  timer,
  nowMs,
  copy,
  compact = false,
  onStop,
  extendOptions,
  onExtend,
  atMaximum = false,
}: TimerTileProps) {
  const phase = phaseOf(timer, nowMs);
  const left = remainingSeconds(timer, nowMs);
  const warning = isWarningDue(timer, nowMs);
  const ratio = progressRatio(timer, nowMs);

  return (
    <article
      data-testid="timer-tile"
      data-timer-id={timer.id}
      data-phase={phase}
      data-warning={warning ? 'due' : 'none'}
      className={cn(
        // Card radius `2xl` (24px) and elevation instead of an outline, per the
        // design system's card rules (docs/rebuild-design-gaps.md §7).
        'flex flex-col gap-4 rounded-2xl bg-surface-container-lowest p-6 shadow-sm transition-shadow duration-200 ease-brand hover:shadow-md',
        compact && 'gap-3 rounded-xl p-4'
      )}
    >
      <header className="flex items-center gap-3">
        {/* `IconMedallion` — the shared tinted-tile shape (`components.md`),
            in place of the hand-rolled circle this used to be. */}
        <IconMedallion
          icon="timer"
          filled
          tint="brand-container"
          shape="circle"
          size={compact ? 'md' : 'lg'}
          aria-hidden
        />
        <h3
          data-testid="timer-label"
          className={cn(
            'min-w-0 flex-1 truncate font-display font-bold',
            compact ? 'text-h3' : 'text-h2'
          )}
        >
          {timer.label}
        </h3>
        {timer.memberName ? (
          // `Chip/Removable` shape (`components.md`) — `bg:#e7e8e9` is the
          // `muted` badge variant's own token, not the input-fill shade the
          // hand-rolled span used.
          <Badge
            variant="muted"
            size="md"
            render={<span data-testid="timer-member">{timer.memberName}</span>}
          />
        ) : null}
      </header>

      <p
        data-testid="timer-digits"
        aria-label={copy.remainingLabel}
        // Not through `cn()`: tailwind-merge would treat the Display size as a
        // `text-` colour and drop it (see the note in `./tokens.ts`).
        className={compact ? COUNTDOWN_DIGIT_CLASS_COMPACT : COUNTDOWN_DIGIT_CLASS}
        style={phase === 'overrun' ? OVERRUN_PULSE_STYLE : undefined}
      >
        {formatCountdown(left)}
      </p>

      {/* A single progress line — the six-foot read is the digits; this is the
          peripheral one for a child who cannot yet read them. Pill-radius and
          thicker since M19, so it reads as the same material as the star bar on
          the reward hero rather than as a hairline. */}
      <ProgressBar
        data-testid="timer-progress"
        value={Math.round(ratio * 100)}
        size={compact ? 'md' : 'lg'}
      />

      {phase === 'overrun' ? (
        <p data-testid="timer-overrun" className="text-body-lg text-ink-secondary">
          {copy.overrun}
        </p>
      ) : warning && copy.warning ? (
        <p
          data-testid="timer-warning"
          // `polite`, not `assertive`: a transition warning is information the
          // room can take at its own pace, not an interruption.
          aria-live="polite"
          className="flex items-center gap-2 text-body-lg text-ink-secondary"
        >
          <Icon name="timer" size="sm" />
          {copy.warning}
        </p>
      ) : null}

      {/* The `atMaximum` line keeps its own distinguishable slot: a chip, not a
          disabled button and not an alert. It is stated where the extend
          buttons would have been, so the absence of the controls is explained
          in the same place it is noticed. */}
      {atMaximum && copy.atMaximum ? (
        <p
          data-testid="timer-at-maximum"
          aria-live="polite"
          className="flex w-max items-center gap-2 rounded-4xl bg-surface-container px-4 py-2 text-body text-ink-secondary"
        >
          <Icon name="hourglass_top" size="sm" />
          {copy.atMaximum}
        </p>
      ) : null}

      {/* M19: the controls are the shared `<Button>` rather than hand-rolled
          boxes (docs/rebuild-design-gaps.md §7). Non-`compact` tiles are the
          hub board's — the wall kiosk `motion.md`'s "Big tap target" specimen
          sizes primary/high-frequency actions for ("64px on tablet vs. 48px
          minimum") — so they step up to `size="tablet"`; `compact` tiles (the
          Controller, the ambient board) stay at the `hub` 48px floor.
          `TIMER_TAP_TARGET_CLASS` stays applied on top either way, so the
          minimum is still stated where the legibility test reads it. */}
      {(onStop && copy.stopLabel) || (onExtend && extendOptions?.length && !atMaximum) ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {onStop && copy.stopLabel ? (
            <Button
              type="button"
              variant="outline"
              size={compact ? 'hub' : 'tablet'}
              data-testid="timer-stop"
              aria-label={copy.stopLabel}
              onClick={onStop}
              className={cn(TIMER_TAP_TARGET_CLASS, 'rounded-4xl')}
            >
              {copy.stopLabel}
            </Button>
          ) : null}

          {/* "A bit longer" sits *next to* stop, in the same weight and the
              same colours. It is not an escape hatch and not a reward: the
              board offers more time the way it offers less, and neither
              choice is marked (FR11). */}
          {onExtend && !atMaximum
            ? extendOptions?.map((option) => (
                <Button
                  key={option.minutes}
                  type="button"
                  variant="outline"
                  size={compact ? 'hub' : 'tablet'}
                  data-testid="timer-extend"
                  data-minutes={option.minutes}
                  aria-label={option.ariaLabel}
                  onClick={() => onExtend(option.minutes)}
                  className={cn(TIMER_TAP_TARGET_CLASS, 'tabular-time rounded-4xl px-5')}
                >
                  {option.label}
                </Button>
              ))
            : null}
        </div>
      ) : null}
    </article>
  );
}
