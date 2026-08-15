import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The weekday-over-number atom: an uppercase day label above a circled date,
 * whose ground and ink swap when the day is the selected one.
 *
 * It is the same mark in five places — the week strip, the month grid, the
 * phone's month grid, the agenda's date rail and the hub's big date — and
 * three marks that agree read as one system where five that nearly agree read
 * as five accidents. Before this component the five differed in *diameter*
 * (30 / 32 / 34 / 56px), in weight (`font-bold` vs `font-extrabold`) and in
 * whether "today" was a fill or a colour.
 *
 * **The size ramp is four steps, and deliberately shorter than the five
 * diameters it replaces.** A circle's job is to be a legible number and a tap
 * target; a 2px difference between two of them is not a design decision, it is
 * drift. So:
 *
 * | size | circle | number      | used for                              |
 * | ---- | ------ | ----------- | ------------------------------------- |
 * | `sm` | 28px   | `body-sm`   | dense grids — a month at 390px        |
 * | `md` | 32px   | `body-sm`   | the default: week strips, month cells |
 * | `lg` | 40px   | `h3`        | an agenda's date rail                 |
 * | `xl` | 56px   | `display-md`| the one big date at the top of a hub  |
 *
 * `md` absorbs the old 30 / 32 / 34, which is the point: seven `md` circles
 * still fit across 390px, and the row that used 34px gains two pixels of tap
 * target rather than losing a size of its own.
 *
 * The label is 10px at `sm`/`md` and 11px at `lg`/`xl` — below `label-overline`'s
 * 12px, because at a circle's width a 12px weekday is wider than the number it
 * sits over and the pair stops reading as one mark.
 *
 * **This is an atom, not a control.** It renders a `<span>` and has no click
 * behaviour, no `aria-current` and no roving focus: the five callers each wrap
 * it in their own `<button>` with their own selection semantics, and a circle
 * that carried half of those would fight them.
 *
 * The numerals are `tabular-time` so that `1` and `11` occupy the same width
 * and a grid of them does not shimmer as the month changes.
 */

/** See the ramp table above. */
export type DateCircleSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * - `default` — an ordinary day.
 * - `today` — the live date, marked with the brand *colour* and not a fill,
 *   so that a strip browsed away from today still shows where today was.
 * - `selected` — the day in focus, marked with the brand *fill*. `selected`
 *   wins over `today` when a day is both, because a strip may only ever have
 *   one filled circle.
 * - `muted` — a day that is on screen but not of this month, or a weekend in a
 *   view that dims them.
 */
export type DateCircleState = 'default' | 'today' | 'selected' | 'muted';

type SizeSpec = { circle: string; number: string; label: string; gap: string };

const SIZES: Record<DateCircleSize, SizeSpec> = {
  sm: { circle: 'size-7', number: 'text-body-sm', label: 'text-[10px]', gap: 'gap-0.5' },
  md: { circle: 'size-8', number: 'text-body-sm', label: 'text-[10px]', gap: 'gap-1' },
  lg: { circle: 'size-10', number: 'text-h3', label: 'text-[11px]', gap: 'gap-1' },
  xl: { circle: 'size-14', number: 'text-display-md', label: 'text-[11px]', gap: 'gap-1' },
};

const STATES: Record<DateCircleState, string> = {
  default: 'text-ink',
  today: 'text-primary',
  selected: 'bg-primary text-primary-foreground',
  muted: 'text-ink-muted',
};

export type DateCircleProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** The weekday, already abbreviated and localised — `ma`, `Mon`. Rendered uppercase. */
  label: React.ReactNode;
  /** The day of the month. */
  number: React.ReactNode;
  state?: DateCircleState;
  size?: DateCircleSize;
  /**
   * The event marker under the circle. `true` draws the built-in 4px dot,
   * which follows the state (brand on a selected day, `--line` otherwise);
   * a node draws that instead, for the callers that colour it by category.
   * The slot keeps its height either way, so a row of circles with and
   * without events stays on one baseline.
   */
  dot?: boolean | React.ReactNode;
};

export function DateCircle({
  label,
  number,
  state = 'default',
  size = 'md',
  dot,
  className,
  ...props
}: DateCircleProps) {
  const spec = SIZES[size];

  return (
    <span
      data-slot="date-circle"
      data-state={state}
      data-size={size}
      className={cn('inline-flex flex-col items-center', spec.gap, className)}
      {...props}
    >
      <span
        className={cn(
          'label-overline leading-none text-ink-muted uppercase',
          spec.label,
          state === 'selected' && 'text-ink-secondary'
        )}
      >
        {label}
      </span>

      <span
        className={cn(
          'tabular-time inline-flex items-center justify-center rounded-full font-display font-bold',
          spec.circle,
          spec.number,
          STATES[state]
        )}
      >
        {number}
      </span>

      {dot === undefined || dot === false ? null : (
        <span aria-hidden className="flex h-1 items-center justify-center">
          {dot === true ? (
            <span
              className={cn('size-1 rounded-full', state === 'selected' ? 'bg-primary' : 'bg-line')}
            />
          ) : (
            dot
          )}
        </span>
      )}
    </span>
  );
}
