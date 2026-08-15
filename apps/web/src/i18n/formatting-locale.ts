import type { FormattingLocale as UiFormattingLocale } from '@kynite/ui';
import type { Locale } from './routing';

/**
 * The date/time convention a household reads by, separate from the UI
 * *language* (`Locale`, `nl` | `en`).
 *
 * This split exists because bare `'en'` has no date/time convention of its
 * own — every `Intl` API resolves it to `en-US` (`m/d/yyyy`, 12-hour), which
 * is what produced the bug this type fixes: an English-language household in
 * Amsterdam reading American dates. `nl` never had this problem (`nl` and
 * `nl-NL` agree), which is why only `en` needs a household choice at all —
 * `en-GB` is offered as the default so "English" defaults to the convention
 * most non-US English speakers actually expect, with `en-US` available for
 * households that want it.
 */
export const FORMATTING_LOCALES = ['nl-NL', 'en-GB', 'en-US'] as const;

export type FormattingLocale = (typeof FORMATTING_LOCALES)[number];

/**
 * `@kynite/ui` carries the same union (`src/components/formatting-locale.ts`)
 * because `Calendar`, `DateField` and `TimeField` take it as a prop and the
 * package may not import from the app. This is the tripwire on that copy: the
 * import is `type`-only, so nothing of the client barrel reaches the server
 * modules that read this file, but a convention added on one side and not the
 * other stops being assignable and `pnpm typecheck` says so.
 */
type _SameAsPackage = [FormattingLocale] extends [UiFormattingLocale]
  ? [UiFormattingLocale] extends [FormattingLocale]
    ? true
    : never
  : never;
const _formattingLocalesAgree: _SameAsPackage = true;
void _formattingLocalesAgree;

export function isFormattingLocale(value: unknown): value is FormattingLocale {
  return typeof value === 'string' && (FORMATTING_LOCALES as readonly string[]).includes(value);
}

/**
 * The convention a UI locale implies when no household has picked one yet
 * (a new family, or a surface with no family in scope — marketing, auth, the
 * share-link 404). `nl` only ever means `nl-NL`; `en` defaults to `en-GB`
 * rather than letting `Intl` fall through to `en-US` on its own.
 */
export function defaultFormattingLocale(uiLocale: Locale): FormattingLocale {
  return uiLocale === 'en' ? 'en-GB' : 'nl-NL';
}

/**
 * The Server Component counterpart of `useDateTimeFormat()`
 * (`src/components/formatting/use-date-time-format.ts`) — same reasoning,
 * same `(value, options)` shape, no React hook because Server Components
 * don't get one. Call sites resolve `formattingLocale` themselves (usually
 * via `getHouseholdFormattingLocale()`, `src/modules/family/formatting-locale.ts`)
 * since, unlike the client hook, there is no shared context to read it from.
 */
export function formatDateTime(
  value: Date,
  formattingLocale: FormattingLocale,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(formattingLocale, options).format(value);
}
