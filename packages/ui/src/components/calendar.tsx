'use client';

import * as React from 'react';
import { DayPicker, type Matcher } from 'react-day-picker';
import { enGB, enUS, nl } from 'react-day-picker/locale';

import type { FormattingLocale } from './formatting-locale';
import { cn } from '../lib/utils';
import { Icon } from './icon';

/**
 * The month grid of `docs/design/calendar.md` § "Month view / date picker",
 * built on `react-day-picker` — the same base shadcn's `Calendar` uses, so the
 * keyboard model (arrows across the grid, PageUp/PageDown across months, a
 * `role="grid"` of `gridcell`s) is the tested upstream one rather than
 * something hand-rolled here.
 *
 * Its stylesheet is deliberately **not** imported. Every class comes from the
 * `classNames` map below, in our own tokens: `font-display` (Baloo 2) captions
 * and weekday letters, `tnum` date numbers, an indigo `bg-brand` pill on the
 * selected day. Importing `react-day-picker/style.css` would drop a second,
 * competing set of `--rdp-*` variables into the app for no gain.
 *
 * Localisation comes from the **household's** formatting locale, not the
 * browser's — that is the entire reason `DateField` exists (see
 * `date-time-parts.ts`). The week always starts on Monday, including for
 * `en-US`, because the households using this are European and the rest of the
 * app's week views already start there.
 */

const DATE_FNS_LOCALES = {
  'nl-NL': nl,
  'en-GB': enGB,
  'en-US': enUS,
} as const;

export type CalendarProps = {
  /** Household convention deciding month and weekday names. */
  formattingLocale: FormattingLocale;
  selected?: Date;
  onSelect: (date: Date) => void;
  /** The month shown first — defaults to the selected day, else today. */
  defaultMonth?: Date;
  /** Inclusive bounds; days outside them are rendered but not selectable. */
  min?: Date;
  max?: Date;
  autoFocus?: boolean;
  className?: string;
};

export function Calendar({
  formattingLocale,
  selected,
  onSelect,
  defaultMonth,
  min,
  max,
  autoFocus,
  className,
}: CalendarProps) {
  const disabled: Matcher[] = [];
  if (min) disabled.push({ before: min });
  if (max) disabled.push({ after: max });

  return (
    <DayPicker
      mode="single"
      required
      selected={selected}
      onSelect={(day) => onSelect(day)}
      defaultMonth={defaultMonth ?? selected}
      startMonth={min}
      endMonth={max}
      disabled={disabled}
      showOutsideDays={false}
      weekStartsOn={1}
      autoFocus={autoFocus}
      locale={DATE_FNS_LOCALES[formattingLocale] ?? nl}
      components={{
        Chevron: ({ orientation }) => (
          <Icon name={orientation === 'left' ? 'chevron_left' : 'chevron_right'} size="sm" />
        ),
      }}
      className={cn('w-64 text-ink', className)}
      classNames={{
        months: 'relative flex flex-col',
        month: 'flex flex-col gap-2',
        nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous:
          'flex size-8 items-center justify-center rounded-full text-ink-secondary transition-colors duration-200 ease-brand hover:bg-surface-hover hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:opacity-30',
        button_next:
          'flex size-8 items-center justify-center rounded-full text-ink-secondary transition-colors duration-200 ease-brand hover:bg-surface-hover hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-disabled:pointer-events-none aria-disabled:opacity-30',
        month_caption: 'flex h-8 items-center justify-center',
        // Dutch writes months lowercase; a caption still reads as a heading.
        caption_label: 'font-display text-base font-bold first-letter:uppercase',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'flex-1 font-display text-[11px] font-bold uppercase text-ink-secondary',
        week: 'mt-1 flex w-full',
        day: 'flex-1 p-0 text-center',
        day_button:
          'tnum mx-auto flex size-9 items-center justify-center rounded-full text-[13px] transition-colors duration-200 ease-brand hover:bg-brand/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30',
        today: '[&>button]:font-bold [&>button]:text-brand',
        selected:
          '[&>button]:bg-brand [&>button]:font-bold [&>button]:text-brand-foreground [&>button]:hover:bg-brand',
        outside: 'invisible',
        hidden: 'invisible',
      }}
    />
  );
}
