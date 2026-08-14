'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useFormattingLocale } from '@/components/formatting';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { formatTimeValue, parseTimeInput, timePlaceholderFor, uses12Hour } from './date-time-parts';

/**
 * The clock counterpart of `DateField` — same reasoning, same contract.
 * `<input type="time">` renders 12- or 24-hour by the *browser's* locale, so a
 * household that chose `nl-NL` still read `2:30 PM` on an en-US Chrome. Here
 * the household's convention decides: `14:30` for `nl-NL`/`en-GB`, `2:30 PM`
 * for `en-US`.
 *
 * The submitted value stays 24-hour `HH:mm` in every locale — the wire format
 * the routines schema and the calendar actions already validate.
 */
export type TimeFieldProps = {
  name?: string;
  /** Controlled 24-hour value (`HH:mm`), or `''`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
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

export function TimeField({
  name,
  value,
  defaultValue = '',
  onValueChange,
  required,
  disabled,
  size = 'default',
  className,
  id,
  autoComplete = 'off',
  ...aria
}: TimeFieldProps) {
  const locale = useFormattingLocale();
  const t = useTranslations('common.timeField');
  const placeholder = timePlaceholderFor(locale);
  const controlled = value !== undefined;

  const initial = controlled ? value : defaultValue;
  const [wire, setWire] = React.useState(initial);
  const [text, setText] = React.useState(() => formatTimeValue(initial, locale));

  // See `DateField` for why this is state adjusted during render rather than
  // an effect: the locale and a controlled parent both have to be able to
  // re-derive the text, without the parent's echo of our own emit doing so.
  const [synced, setSynced] = React.useState({ value: initial, locale });
  if (synced.locale !== locale || (controlled && value !== synced.value)) {
    const next = controlled ? value : wire;
    setSynced({ value: next, locale });
    setWire(next);
    setText(formatTimeValue(next, locale));
  }

  const parsed = text.trim() === '' ? '' : parseTimeInput(text);
  const unreadable = parsed === null;

  const inputRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.setCustomValidity(unreadable ? t('invalid', { pattern: placeholder }) : '');
  }, [unreadable, t, placeholder]);

  function handleChange(next: string) {
    setText(next);
    const normalized = next.trim() === '' ? '' : (parseTimeInput(next) ?? '');
    if (normalized !== wire) {
      setWire(normalized);
      setSynced({ value: normalized, locale });
      onValueChange?.(normalized);
    }
  }

  return (
    <>
      {name ? <input type="hidden" name={name} value={wire} /> : null}
      <Input
        ref={inputRef}
        id={id}
        type="text"
        // A 12-hour locale needs letters for AM/PM, so only the 24-hour
        // conventions get the digits-only keypad.
        inputMode={uses12Hour(locale) ? undefined : 'numeric'}
        autoComplete={autoComplete}
        size={size}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={unreadable || undefined}
        className={cn(className)}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          if (wire) setText(formatTimeValue(wire, locale));
        }}
        {...aria}
      />
    </>
  );
}
