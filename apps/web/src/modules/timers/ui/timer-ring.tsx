'use client';

import { cn, Icon, type IconName } from '@kynite/ui';

/**
 * The countdown ring for the fullscreen hub timer (M-T2, `(hub)/hub/timer`).
 *
 * Presentational, like `TimerTile`: it takes an already-clamped ratio and
 * already-formatted digits rather than a `TimerView` and a clock, so a test
 * can assert the drawing without a fake clock and this file never has to
 * import `domain/countdown.ts` at all.
 *
 * Two sizes: `hero` is the promoted timer at the centre of the screen —
 * `text-display-3xl` (M-T2's own addition to the type scale, see
 * `tokens.css`), a thin stroke, and the label read above the digits, icon
 * first. `strip` is the smaller ring in the bottom strip for every other
 * running timer — the label sits *under* the digits there instead, because a
 * row of these reads left-to-right rather than as one held gaze.
 */

const RING_BOX = { hero: 320, strip: 128 } as const;
const RING_RADIUS = { hero: 140, strip: 54 } as const;
const RING_STROKE = { hero: 8, strip: 6 } as const;

/**
 * Where the ring's visible arc ends, in the same units as `circumference`.
 *
 * The ring *fills* as the countdown elapses — the same "how much of the
 * duration has passed" reading `TimerTile`'s `ProgressBar` already gives via
 * `progressRatio`, not a "time left" depletion. `strokeDasharray` is set to
 * the full circumference and this is the `strokeDashoffset`: at `ratio: 0`
 * the whole stroke is hidden (offset = circumference), and at `ratio: 1` none
 * of it is (offset = 0).
 *
 * Pulled out as its own function — not inlined in the JSX below — because it
 * is the one piece of arithmetic in this file worth a unit test independent
 * of React: `ring math (dashoffset from ratio)`.
 */
export function ringDashOffset(ratio: number, circumference: number): number {
  const clamped = Math.min(1, Math.max(0, ratio));
  return circumference * (1 - clamped);
}

export type TimerRingSize = 'hero' | 'strip';

export type TimerRingProps = {
  /** Elapsed fraction, 0..1 — `domain/countdown.ts`'s `progressRatio`. */
  ratio: number;
  /** The timer's name, e.g. "Schoenen aan". */
  label: string;
  icon: IconName;
  /** Already formatted, e.g. "4:30" — `domain/countdown.ts`'s `formatCountdown`. */
  digits: string;
  /** Accessible name for the digits, e.g. "Nog 4 minuten 30 seconden". */
  digitsLabel: string;
  size?: TimerRingSize;
  /** Frozen fill, and the caller decides whether to show a pause glyph too. */
  paused?: boolean;
  className?: string;
};

export function TimerRing({
  ratio,
  label,
  icon,
  digits,
  digitsLabel,
  size = 'hero',
  paused = false,
  className,
}: TimerRingProps) {
  const box = RING_BOX[size];
  const radius = RING_RADIUS[size];
  const stroke = RING_STROKE[size];
  const center = box / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      data-testid="timer-ring"
      data-timer-ring-size={size}
      data-paused={paused ? 'true' : 'false'}
      className={cn(
        'relative flex shrink-0 items-center justify-center',
        size === 'hero' ? 'size-[min(60vh,60vw,26rem)]' : 'size-28 sm:size-32',
        className
      )}
    >
      <svg
        viewBox={`0 0 ${box} ${box}`}
        className="absolute inset-0 h-full w-full -rotate-90"
        aria-hidden="true"
      >
        {/* The track — the full circle, always visible, faint. */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-current text-primary-foreground/15"
        />
        {/* The fill — see `ringDashOffset`. Not animated by a CSS transition on
            `strokeDashoffset` past a second: the digits already move once a
            second, and a ring that glides continuously while they jump would
            visibly disagree with them. */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ringDashOffset(ratio, circumference)}
          className={cn(
            'stroke-current transition-[stroke-dashoffset] duration-500 ease-linear',
            paused ? 'text-primary-foreground/50' : 'text-primary-foreground'
          )}
        />
      </svg>

      <div className="relative flex flex-col items-center gap-1 px-4">
        {size === 'hero' ? (
          <span
            data-testid="timer-ring-label"
            className="flex max-w-full items-center gap-2 truncate text-body-lg font-display font-bold"
          >
            <Icon name={icon} size="sm" />
            <span className="truncate">{label}</span>
          </span>
        ) : null}

        <p
          data-testid="timer-ring-digits"
          aria-label={digitsLabel}
          className={cn(
            'tabular-time font-display leading-none font-extrabold',
            size === 'hero' ? 'text-display-3xl' : 'text-h2'
          )}
        >
          {digits}
        </p>

        {size === 'strip' ? (
          <span
            data-testid="timer-ring-label"
            className="flex max-w-full items-center gap-1 truncate text-overline font-bold"
          >
            <Icon name={icon} size="xs+" />
            <span className="truncate">{label}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}
