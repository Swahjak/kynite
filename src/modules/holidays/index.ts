/**
 * Public surface of the holidays slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * "Speciale dagen": the eleven Dutch public holidays and the six days a family
 * celebrates anyway (Sinterklaas, Halloween, Moederdag, Vaderdag, Dierendag,
 * Oudjaarsavond). They are **computed**, not stored and not fetched — a special
 * day is a function of the year, so this slice has no schema, no queries and no
 * actions, which is why this barrel is the rare one that is safe to import from
 * a client component: everything below is pure.
 *
 * The surfaces that use it:
 *
 * - `modules/calendar/page-data.ts` turns the year's days into read-only
 *   all-day `CalendarEvent`s, once, at the loader every calendar surface
 *   composes (`domain/holidays.ts`).
 * - `modules/calendar/ui/month-view.tsx` marks the cell with the day's emoji.
 * - `modules/today/ui/today-header.tsx` draws the festive chip, the "nog X
 *   nachtjes slapen" line, and mounts the confetti.
 */

export {
  SPECIAL_DAYS_NL,
  SPECIAL_DAY_SLUGS,
  easterSunday,
  type SpecialDay,
  type SpecialDayAccent,
  type SpecialDayDefinition,
  type SpecialDayKind,
  type SpecialDaySlug,
} from './domain/nl';

export {
  CONFETTI_SLUGS,
  COUNTDOWN_NIGHTS,
  COUNTDOWN_SLUGS,
  specialDays,
  specialDaysOn,
  upcomingCountdown,
  type SpecialDayCountdown,
} from './domain/special-days';
