'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { FieldPicker } from './field-picker';
import { Input } from './input';
import { Calendar } from './calendar';
import type { FormattingLocale } from './formatting-locale';
import {
  datePatternFor,
  dateToIso,
  formatDateValue,
  isoToDate,
  parseDateInput,
} from './date-time-parts';

/**
 * A date field that reads and writes in the *household's* convention
 * (`FormattingLocaleProvider`), which `<input type="date">` cannot: a native
 * date input renders its digits and its picker in the **browser's** UI locale,
 * with no API to override it — so an en-US Chrome showed `08/21/2026` in a
 * Dutch household that had explicitly chosen `nl-NL`. This is a text input
 * instead, formatted and parsed by `date-time-parts.ts`.
 *
 * The value crossing the component boundary is unchanged from the native
 * input's: ISO `yyyy-MM-dd`, submitted through a hidden input under `name`, so
 * Server Actions and their validation stay exactly as they were. The visible
 * input carries only display text.
 *
 * Typing is the whole interaction — lenient about separators and short forms
 * (`21-8-26`, `21082026`), normalised to the locale's pattern on blur. While
 * the text is unreadable the field stays in its error state and emits `''`
 * rather than a half-parsed date, and `setCustomValidity` blocks the submit
 * so the browser refuses on the field itself instead of the server refusing
 * afterwards.
 *
 * The trailing calendar button opens a month grid (`Calendar`) as a
 * convenience on top of that, never as a replacement: picking a day writes the
 * same wire value typing would have produced, and a field whose popover is
 * never opened is byte-for-byte the field that shipped without one.
 *
 * Both halves of what used to be read from React context arrive as props here:
 * the household's convention as `locale` (the app reads it from
 * `useFormattingLocale()` in its wrapper) and the three strings as `labels`.
 * `labels.invalid` is expected to already name the pattern — the app builds it
 * with `t('invalid', { pattern: datePatternFor(locale).placeholder })`, which
 * it can, because `datePatternFor` is exported from this package too.
 */
export type DateFieldLabels = {
  /** Accessible name of the trailing calendar button. */
  pick: string;
  /** Validity message while the typed text cannot be read as a date. */
  invalid: string;
  /** Validity message for a readable date outside `min`/`max`. */
  outOfRange: string;
};

const DEFAULT_LABELS: DateFieldLabels = {
  pick: 'Pick a date',
  invalid: 'Enter a date in the expected format.',
  outOfRange: 'That date is outside the allowed range.',
};

export type DateFieldProps = {
  /** The household's date convention; decides pattern, placeholder and grid. */
  locale?: FormattingLocale;
  labels?: Partial<DateFieldLabels>;
  /** Form field name — the hidden input that carries the ISO value. */
  name?: string;
  /** Controlled ISO value (`yyyy-MM-dd`), or `''`. */
  value?: string;
  /** Uncontrolled initial ISO value. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Inclusive ISO bounds, the `min`/`max` of the native input it replaces. */
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'default' | 'hub';
  className?: string;
  id?: string;
  autoComplete?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
};

export function DateField({
  locale = 'nl-NL',
  labels,
  name,
  value,
  defaultValue = '',
  onValueChange,
  min,
  max,
  required,
  disabled,
  size = 'default',
  className,
  id,
  autoComplete = 'off',
  ...aria
}: DateFieldProps) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const pattern = datePatternFor(locale);
  const controlled = value !== undefined;

  const initial = controlled ? value : defaultValue;
  const [wire, setWire] = React.useState(initial);
  const [text, setText] = React.useState(() => formatDateValue(initial, locale));

  // Re-derive the display text when the household's convention changes, or
  // when a controlled parent hands down a value we did not just emit — React's
  // "adjust state while rendering" pattern. `synced` is updated on emit too,
  // precisely so a parent echoing our own change straight back does not
  // reformat the text mid-keystroke (`1-8-2026` → `01-08-2026` while typing).
  const [synced, setSynced] = React.useState({ value: initial, locale });
  if (synced.locale !== locale || (controlled && value !== synced.value)) {
    const next = controlled ? value : wire;
    setSynced({ value: next, locale });
    setWire(next);
    setText(formatDateValue(next, locale));
  }

  const parsed = text.trim() === '' ? '' : parseDateInput(text, locale);
  const unreadable = parsed === null;
  const outOfRange =
    !unreadable &&
    parsed !== '' &&
    ((min != null && parsed < min) || (max != null && parsed > max));

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(unreadable ? copy.invalid : outOfRange ? copy.outOfRange : '');
  }, [unreadable, outOfRange, copy.invalid, copy.outOfRange]);

  function handleChange(next: string) {
    setText(next);
    const iso = next.trim() === '' ? '' : (parseDateInput(next, locale) ?? '');
    if (iso !== wire) {
      setWire(iso);
      setSynced({ value: iso, locale });
      onValueChange?.(iso);
    }
  }

  /** A day picked from the calendar — written exactly as typing writes it. */
  function commit(iso: string) {
    setText(formatDateValue(iso, locale));
    if (iso !== wire) {
      setWire(iso);
      setSynced({ value: iso, locale });
      onValueChange?.(iso);
    }
  }

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const selectedDay = isoToDate(wire);

  return (
    <div data-slot="date-field" className={cn('relative w-full', className)}>
      {name ? <input type="hidden" name={name} value={wire} /> : null}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete={autoComplete}
        size={size}
        required={required}
        disabled={disabled}
        placeholder={pattern.placeholder}
        aria-invalid={unreadable || outOfRange || undefined}
        className={size === 'hub' ? 'pr-12' : 'pr-9'}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          // Normalise what parsed; leave unreadable text alone so the parent
          // can see and fix what they typed rather than losing it.
          if (wire) setText(formatDateValue(wire, locale));
        }}
        {...aria}
      />
      <FieldPicker
        icon="calendar_month"
        label={copy.pick}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        disabled={disabled}
        size={size}
        finalFocus={inputRef}
      >
        <Calendar
          formattingLocale={locale}
          selected={selectedDay}
          min={min ? isoToDate(min) : undefined}
          max={max ? isoToDate(max) : undefined}
          autoFocus
          onSelect={(day) => {
            commit(dateToIso(day));
            setPickerOpen(false);
          }}
        />
      </FieldPicker>
    </div>
  );
}
