'use client';

import { useTranslations } from 'next-intl';

import { useFormattingLocale } from '@/components/formatting';
import { DateField as UiDateField, datePatternFor } from '@kynite/ui';

/**
 * `@kynite/ui`'s `DateField`, wired to this app's two sources of locale.
 *
 * The primitive is deliberately ignorant of both: it takes the household's
 * convention as `locale` and its three strings as `labels`, which is what let
 * it move into the design system at all. This wrapper is where the two are
 * read — `useFormattingLocale()` for the convention (a plain React context,
 * *not* next-intl's `locale`; see `formatting-locale-provider.tsx` for why
 * those must stay separate) and `useTranslations` for the copy.
 *
 * The pattern hint inside the invalid message is built here too, from the same
 * `datePatternFor` the field itself uses, so the message a parent reads names
 * the format the placeholder is showing them.
 */
export function DateField(
  props: Omit<React.ComponentProps<typeof UiDateField>, 'locale' | 'labels'>
) {
  const locale = useFormattingLocale();
  const t = useTranslations('common.dateField');

  return (
    <UiDateField
      locale={locale}
      labels={{
        pick: t('pickDate'),
        invalid: t('invalid', { pattern: datePatternFor(locale).placeholder }),
        outOfRange: t('outOfRange'),
      }}
      {...props}
    />
  );
}

export type { DateFieldProps } from '@kynite/ui';
