/**
 * The date/time convention a household reads by — the package's own copy.
 *
 * The app has the same union in `src/i18n/formatting-locale.ts`, together with
 * everything that *decides* it: the UI-locale fallback, the Zod guard, the
 * household lookup. None of that belongs here — `@kynite/ui` never chooses a
 * convention, it only renders in the one it is handed, which is why the type
 * arrives as a `locale` prop on `Calendar`, `DateField` and `TimeField`
 * instead of through a context the package would have to own.
 *
 * The duplication is a three-string union, and it is deliberate: importing the
 * app's module would break the package boundary, and having the *app* import
 * this one would pull the whole client barrel into `i18n/`, which server code
 * reads. Instead `apps/web/src/i18n/formatting-locale.ts` carries a `type`-only
 * assertion that the two unions are mutually assignable, so a value added on
 * one side and not the other fails `pnpm typecheck` rather than drifting.
 */
export const FORMATTING_LOCALES = ['nl-NL', 'en-GB', 'en-US'] as const;

export type FormattingLocale = (typeof FORMATTING_LOCALES)[number];
