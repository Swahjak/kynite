'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { useFormattingLocale } from '@/components/formatting';
import type { FormattingLocale } from '@/i18n/formatting-locale';
import { cn } from '@/lib/utils';
import { FieldPicker } from './field-picker';
import { Input } from './input';
import {
  QUARTER_HOUR_VALUES,
  formatTimeValue,
  parseTimeInput,
  timePlaceholderFor,
  uses12Hour,
} from './date-time-parts';

/**
 * The clock counterpart of `DateField` — same reasoning, same contract.
 * `<input type="time">` renders 12- or 24-hour by the *browser's* locale, so a
 * household that chose `nl-NL` still read `2:30 PM` on an en-US Chrome. Here
 * the household's convention decides: `14:30` for `nl-NL`/`en-GB`, `2:30 PM`
 * for `en-US`.
 *
 * The submitted value stays 24-hour `HH:mm` in every locale — the wire format
 * the routines schema and the calendar actions already validate.
 *
 * The trailing clock button lists the quarter hours as a shortcut. It is not a
 * constraint: `07:20` typed into the field is as valid as it ever was, it
 * simply isn't one of the 96 entries worth offering in a list.
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

  /** A time picked from the list — written exactly as typing writes it. */
  function commit(next: string) {
    setText(formatTimeValue(next, locale));
    if (next !== wire) {
      setWire(next);
      setSynced({ value: next, locale });
      onValueChange?.(next);
    }
  }

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const activeOptionRef = React.useRef<HTMLButtonElement>(null);

  return (
    <div data-slot="time-field" className={cn('relative w-full', className)}>
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
        className={size === 'hub' ? 'pr-12' : 'pr-9'}
        value={text}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => {
          if (wire) setText(formatTimeValue(wire, locale));
        }}
        {...aria}
      />
      <FieldPicker
        icon="schedule"
        label={t('pickTime')}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        disabled={disabled}
        size={size}
        finalFocus={inputRef}
        initialFocus={activeOptionRef}
      >
        <TimeOptionList
          label={t('pickTime')}
          locale={locale}
          value={wire}
          activeRef={activeOptionRef}
          onPick={(next) => {
            commit(next);
            setPickerOpen(false);
          }}
        />
      </FieldPicker>
    </div>
  );
}

/**
 * The quarter hours as a scrollable listbox.
 *
 * Roving `tabIndex` rather than a focus trap: one Tab stop for the whole list,
 * arrows (and Home/End) move between entries, Enter/Space picks — which comes
 * free from each entry being a real `<button>`, so nothing here re-implements
 * activation. The entry matching the field's value is the one that starts
 * focused (and is scrolled into view), so opening the list on `14:30` puts the
 * afternoon under the cursor instead of midnight.
 */
function TimeOptionList({
  label,
  locale,
  value,
  activeRef,
  onPick,
}: {
  label: string;
  locale: FormattingLocale;
  value: string;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  onPick: (value: string) => void;
}) {
  const selectedIndex = QUARTER_HOUR_VALUES.indexOf(value);
  const [activeIndex, setActiveIndex] = React.useState(selectedIndex === -1 ? 0 : selectedIndex);
  const itemsRef = React.useRef<Array<HTMLButtonElement | null>>([]);

  React.useEffect(() => {
    // jsdom has no `scrollIntoView`; the list is still perfectly usable there.
    itemsRef.current[activeIndex]?.scrollIntoView?.({ block: 'center' });
    // Only on mount — afterwards the browser scrolls focus into view itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function move(event: React.KeyboardEvent, next: number) {
    event.preventDefault();
    const clamped = Math.min(Math.max(next, 0), QUARTER_HOUR_VALUES.length - 1);
    setActiveIndex(clamped);
    itemsRef.current[clamped]?.focus();
  }

  return (
    <div
      role="listbox"
      aria-label={label}
      data-slot="time-option-list"
      className="flex max-h-64 w-32 flex-col gap-0.5 overflow-y-auto"
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') move(event, activeIndex + 1);
        else if (event.key === 'ArrowUp') move(event, activeIndex - 1);
        else if (event.key === 'Home') move(event, 0);
        else if (event.key === 'End') move(event, QUARTER_HOUR_VALUES.length - 1);
      }}
    >
      {QUARTER_HOUR_VALUES.map((option, index) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={selected}
            data-time={option}
            tabIndex={index === activeIndex ? 0 : -1}
            ref={(node) => {
              itemsRef.current[index] = node;
              if (index === activeIndex && activeRef) activeRef.current = node;
            }}
            onClick={() => onPick(option)}
            className={cn(
              'tnum shrink-0 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ease-brand hover:bg-brand/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              selected && 'bg-brand font-bold text-brand-foreground hover:bg-brand'
            )}
          >
            {formatTimeValue(option, locale)}
          </button>
        );
      })}
    </div>
  );
}
