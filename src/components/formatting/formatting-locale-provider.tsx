'use client';

import { createContext, useContext, useMemo } from 'react';
import type { FormattingLocale } from '@/i18n/formatting-locale';

/**
 * Carries the household's date/time convention (`src/i18n/formatting-locale.ts`)
 * down to `useDateTimeFormat()` (`use-date-time-format.ts`).
 *
 * This is a plain React context, deliberately **not** next-intl's. next-intl
 * has exactly one `locale` per `NextIntlClientProvider`, and that same value
 * drives `useLocale()` — which `Link`/`redirect()`/`useRouter()` from
 * `@/i18n/navigation` read to build the `/nl/...` or `/en/...` URL prefix
 * (`createSharedNavigationFns` in `next-intl/navigation` always prefixes with
 * `locale || curLocale`). Overriding next-intl's `locale` to a formatting
 * locale like `en-GB` to fix date rendering would therefore also send every
 * `Link` in the overridden subtree to a `/en-GB/...` URL that `routing.ts`
 * does not recognise — routing would break to fix formatting. A second,
 * independent context sidesteps that: it only ever feeds `Intl.DateTimeFormat`
 * calls, so it can safely wrap the same tree (nav chrome included) that
 * `NextIntlClientProvider`'s `timeZone` override already wraps in
 * `(app)/layout.tsx` and `(hub)/layout.tsx`.
 */
const FormattingLocaleContext = createContext<FormattingLocale | null>(null);

export function FormattingLocaleProvider({
  formattingLocale,
  children,
}: {
  formattingLocale: FormattingLocale;
  children: React.ReactNode;
}) {
  return (
    <FormattingLocaleContext.Provider value={formattingLocale}>
      {children}
    </FormattingLocaleContext.Provider>
  );
}

/**
 * Falls back to `nl-NL` outside any provider (e.g. a unit-tested component
 * rendered in isolation) rather than throwing — the same forgiving default
 * `defaultFormattingLocale()` uses for a surface with no household in scope.
 */
export function useFormattingLocale(): FormattingLocale {
  const value = useContext(FormattingLocaleContext);
  return useMemo(() => value ?? 'nl-NL', [value]);
}
