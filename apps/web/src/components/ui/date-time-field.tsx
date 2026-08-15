'use client';

import { useTranslations } from 'next-intl';

import { useFormattingLocale } from '@/components/formatting';
import { DateTimeField as UiDateTimeField, datePatternFor, timePlaceholderFor } from '@kynite/ui';

/**
 * The `<input type="datetime-local">` replacement, localised.
 *
 * `dateLabel` and `timeLabel` stay the caller's job — they name *this*
 * field's halves ("Begint om, Datum") and only the call site knows the
 * sentence. Everything else is the same copy every date and time field in the
 * app uses, so it is filled in here exactly as `date-field.tsx` and
 * `time-field.tsx` fill in their own.
 */
export function DateTimeField(
  props: Omit<React.ComponentProps<typeof UiDateTimeField>, 'locale' | 'dateLabels' | 'timeLabels'>
) {
  const locale = useFormattingLocale();
  const date = useTranslations('common.dateField');
  const time = useTranslations('common.timeField');

  return (
    <UiDateTimeField
      locale={locale}
      dateLabels={{
        pick: date('pickDate'),
        invalid: date('invalid', { pattern: datePatternFor(locale).placeholder }),
        outOfRange: date('outOfRange'),
      }}
      timeLabels={{
        pick: time('pickTime'),
        invalid: time('invalid', { pattern: timePlaceholderFor(locale) }),
      }}
      {...props}
    />
  );
}

export type { DateTimeFieldProps } from '@kynite/ui';
