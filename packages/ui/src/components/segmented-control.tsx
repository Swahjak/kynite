'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

/**
 * The sheets' two-up segmented switch: a soft track with the chosen half
 * lifted out of it in white ("Herhalend / Eenmalig klusje", "Bonus /
 * Verrassing").
 *
 * A radio group underneath, not a row of buttons. The choice is a *mode* — one
 * of these is always true and picking one un-picks the other — and that is what
 * radios mean to a keyboard and to a screen reader. Buttons would say "two
 * independent actions", which is exactly the misreading the control exists to
 * prevent.
 *
 * Uncontrolled by design: it posts a real form value under `name`, so the app's
 * Server Action reads it the same way it reads a text field. Pass `value` +
 * `onValueChange` when the surrounding form has to react to the mode (the
 * routine builder swaps a weekday picker for a date picker on it).
 */

export type SegmentedOption<Value extends string> = {
  value: Value;
  label: string;
};

export function SegmentedControl<Value extends string>({
  name,
  options,
  value,
  onValueChange,
  label,
  testIdPrefix,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  name: string;
  /** Test ids are `<prefix>-<value>`. Defaults to the field name. */
  testIdPrefix?: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onValueChange: (next: Value) => void;
  /** Accessible name of the group — it has no visible heading of its own. */
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-slot="segmented-control"
      data-testid={testIdPrefix ?? name}
      className={cn('flex gap-1 rounded-4xl bg-surface-container p-1', className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <label
            key={option.value}
            data-testid={`${testIdPrefix ?? name}-${option.value}`}
            data-selected={selected ? 'true' : 'false'}
            className={cn(
              'flex flex-1 cursor-pointer items-center justify-center rounded-4xl py-2 text-center font-display text-body-sm font-bold transition-colors duration-200 ease-brand',
              selected ? 'bg-card text-ink shadow-sm' : 'text-ink-muted hover:text-ink-secondary'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
