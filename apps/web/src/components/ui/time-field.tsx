'use client';

import { useTranslations } from 'next-intl';

import { useFormattingLocale } from '@/components/formatting';
import { TimeField as UiTimeField, timePlaceholderFor } from '@kynite/ui';

/** The clock counterpart of `date-field.tsx` — same seam, same reasoning. */
export function TimeField(
  props: Omit<React.ComponentProps<typeof UiTimeField>, 'locale' | 'labels'>
) {
  const locale = useFormattingLocale();
  const t = useTranslations('common.timeField');

  return (
    <UiTimeField
      locale={locale}
      labels={{
        pick: t('pickTime'),
        invalid: t('invalid', { pattern: timePlaceholderFor(locale) }),
      }}
      {...props}
    />
  );
}

export type { TimeFieldProps } from '@kynite/ui';
