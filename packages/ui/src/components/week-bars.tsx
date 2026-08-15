'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * A week of stars as seven bars — the `savings` horizon's "how am I doing this
 * week", and nothing more than that.
 *
 * Two rules hold it to the design sheets:
 *
 * - **Seven bars, always.** A day with nothing earned keeps its column and its
 *   label and draws a hairline rule where its bar would be. It is not omitted,
 *   not annotated and not coloured — the absence *is* the rendering, and a week
 *   that quietly dropped its empty days would read as a shorter week than the
 *   one the child lived.
 * - **Today is the only marked column.** It carries the solid gold and the
 *   darker label; the rest are the same gold at less weight. Nothing here marks
 *   a day as bad, because none of them are.
 */

export type WeekBar = {
  /** Stable key — the ISO day in the app, the weekday label in a story. */
  key: string;
  label: string;
  value: number;
  today?: boolean;
  /**
   * The bar's accessible name, e.g. "ma: 3 sterren". A string per day rather
   * than a formatter function, because this component renders inside a server
   * component and React cannot serialise a function across that boundary.
   */
  srLabel: string;
};

export function WeekBars({
  days,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  days: readonly WeekBar[];
}) {
  const peak = Math.max(1, ...days.map((day) => day.value));

  return (
    <div
      data-slot="week-bars"
      className={cn('flex h-28 items-end justify-between gap-2', className)}
      {...props}
    >
      {days.map((day) => (
        <div
          key={day.key}
          data-testid="week-bar"
          data-day={day.key}
          data-total={day.value}
          data-today={day.today ? 'true' : 'false'}
          className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
        >
          <span
            role="img"
            aria-label={day.srLabel}
            className={cn(
              'block w-full rounded-lg transition-[height] duration-500 ease-brand',
              day.value === 0 ? 'bg-line-subtle' : day.today ? 'bg-gold' : 'bg-gold/45'
            )}
            // The zero day's hairline: a rule, not a bar. Inline because the
            // height is data, and 2px is smaller than any spacing step.
            style={{
              height: day.value === 0 ? 2 : `${Math.max(6, (day.value / peak) * 100)}%`,
            }}
          />
          <span
            aria-hidden
            className={cn(
              'text-center font-display text-caption font-bold',
              day.today ? 'text-ink' : 'text-ink-muted'
            )}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}
