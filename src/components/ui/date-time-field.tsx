'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';
import { DateField } from './date-field';
import { TimeField } from './time-field';
import { joinDateTimeValue, splitDateTimeValue } from './date-time-parts';

/**
 * What replaces `<input type="datetime-local">`: a `DateField` and a
 * `TimeField` side by side, submitting one `yyyy-MM-ddTHH:mm` value under
 * `name` — byte-for-byte the value the native input produced, so the calendar
 * actions and their Zod schemas are untouched.
 *
 * Two controls means two labels: the pair is a `role="group"` labelled by the
 * caller's own field label (`aria-labelledby`), and each half carries its own
 * short label ("Datum" / "Tijd") so a screen reader announces "Begint om,
 * Datum" rather than the same word twice. That is also why this is a group and
 * not a `Field.Root` — Base UI's `Field` binds its label to exactly one
 * control, which is the wrong shape for two (see `FieldGroupLabel`).
 */
export type DateTimeFieldProps = {
  name?: string;
  /** Controlled `yyyy-MM-ddTHH:mm` value, or `''`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  size?: 'default' | 'hub';
  className?: string;
  /** The id of the label naming the pair as a whole. */
  'aria-labelledby'?: string;
  /** Accessible name for the date half — e.g. `t('form.date')`. */
  dateLabel: string;
  /** Accessible name for the time half — e.g. `t('form.time')`. */
  timeLabel: string;
  'data-testid'?: string;
};

export function DateTimeField({
  name,
  value,
  defaultValue = '',
  onValueChange,
  required,
  disabled,
  size = 'default',
  className,
  dateLabel,
  timeLabel,
  'aria-labelledby': ariaLabelledBy,
  'data-testid': testId,
}: DateTimeFieldProps) {
  const controlled = value !== undefined;
  const initial = splitDateTimeValue(controlled ? value : defaultValue);

  const [date, setDate] = React.useState(initial.date);
  const [time, setTime] = React.useState(initial.time);

  // Same "adjust state while rendering" shape as the two halves — a
  // controlled parent can push a new instant in, but its echo of our own emit
  // must not reset the half the parent is still typing in.
  const [synced, setSynced] = React.useState(controlled ? value : defaultValue);
  if (controlled && value !== synced) {
    setSynced(value);
    const next = splitDateTimeValue(value);
    setDate(next.date);
    setTime(next.time);
  }

  function emit(nextDate: string, nextTime: string) {
    const joined = joinDateTimeValue(nextDate, nextTime);
    setSynced(joined);
    onValueChange?.(joined);
  }

  return (
    <div
      role="group"
      aria-labelledby={ariaLabelledBy}
      data-slot="date-time-field"
      data-testid={testId}
      className={cn('flex gap-2', className)}
    >
      {name ? <input type="hidden" name={name} value={joinDateTimeValue(date, time)} /> : null}
      <DateField
        aria-label={dateLabel}
        value={date}
        onValueChange={(next) => {
          setDate(next);
          emit(next, time);
        }}
        required={required}
        disabled={disabled}
        size={size}
        className="flex-2"
      />
      <TimeField
        aria-label={timeLabel}
        value={time}
        onValueChange={(next) => {
          setTime(next);
          emit(date, next);
        }}
        required={required}
        disabled={disabled}
        size={size}
        className="flex-1"
      />
    </div>
  );
}
