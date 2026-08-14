'use client';

import { useMemo } from 'react';
import { useTimeZone } from 'next-intl';
import { useFormattingLocale } from './formatting-locale-provider';

/**
 * Formats a date/time in the household's convention (`FormattingLocaleProvider`)
 * rather than in the UI language's default `Intl` behaviour.
 *
 * Deliberately not `useFormatter().dateTime` (next-intl): that method resolves
 * against the *UI locale* (`nl` | `en`), and bare `en` is exactly the bug this
 * hook exists to fix — `Intl` has no neutral "English" convention and falls
 * through to `en-US` (`m/d/yyyy`, 12-hour) the instant the locale string isn't
 * region-qualified. This hook takes the household's resolved convention
 * (`nl-NL` | `en-GB` | `en-US`) instead.
 *
 * Mirrors `useFormatter().dateTime`'s shape — `format(value, options)`,
 * `timeZone` defaulted from context when the caller doesn't supply one — so
 * swapping a call site is a one-line change (`useFormatter()` →
 * `useDateTimeFormat()`, `format.dateTime(...)` → `format(...)`), not a
 * rewrite. `useTimeZone()` is next-intl's own hook and stays in play
 * unchanged: it carries no `en`-vs-`en-GB` ambiguity, so it isn't part of the
 * bug this split addresses (see the provider's doc comment for why `locale`
 * specifically can't be reused this way).
 */
export function useDateTimeFormat() {
  const formattingLocale = useFormattingLocale();
  const timeZone = useTimeZone();

  return useMemo(() => {
    return (value: Date, options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(formattingLocale, { timeZone, ...options }).format(value);
  }, [formattingLocale, timeZone]);
}
