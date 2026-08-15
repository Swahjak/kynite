/**
 * Which theme a day wears — the one decision the Vandaag banner is.
 *
 * Three sources feed it, and they are three different *kinds* of fact:
 *
 * - a **birthday**, which belongs to a person in this household;
 * - a **speciale dag**, which is arithmetic (`holidays/domain/nl.ts`);
 * - a **schoolvakantie**, which is a period out of a published table
 *   (`holidays/domain/school-holidays.ts`).
 *
 * The banner draws one of them or nothing, so somebody has to pick, and the
 * picking is here rather than in the component for two reasons. It is a pure
 * function of a date and a list of people, so it is testable without a render;
 * and the *page* has to know the answer too — on a themed day the banner takes
 * the NU block's place rather than sitting above it ("Vandaag met thema's",
 * where the NU block is wrapped in `<sc-if geenThema>`), and a component that
 * decides late cannot tell its parent to stand down.
 *
 * ## The order, and why
 *
 * A birthday outranks everything. It is the only one of the three that is about
 * a person in the room, and a seven-year-old whose birthday fell in the
 * Christmas holiday would not accept "Twee weken lekker niksen" as the
 * headline. Then the day itself — Kerst, Koningsdag, Pakjesavond — because a
 * named day is more specific than the fortnight around it. Then the period.
 *
 * A countdown is only ever offered when nothing is happening *today*: "nog 3
 * nachtjes" under a banner that already says today is the day would be a wrong
 * number, and it is offered only on today, because a countdown under a browsed
 * date is a wrong number too.
 */

import {
  COUNTDOWN_NIGHTS,
  SPECIAL_DAYS_NL,
  birthdaysOn,
  schoolHolidayLength,
  schoolHolidayOn,
  specialDaysOn,
  upcomingBirthday,
  upcomingCountdown,
  upcomingSchoolHoliday,
  type BirthdayPerson,
  type SpecialDayAccent,
} from '@/modules/holidays';

/**
 * The resolved theme, in the one shape the banner draws.
 *
 * Flattened deliberately: three sources with three payload types would make the
 * component branch three ways to render the same five slots. What actually
 * differs between them is which message namespace names the day, and that is
 * `source` + `key`.
 */
export type TodayTheme = {
  /** Which vocabulary names it: `holidays.days.*`, `holidays.school.*`, or the birthday copy. */
  source: 'birthday' | 'special' | 'school';
  /** `christmasDay`, `summerBreak`, or `birthday`. */
  key: string;
  accent: SpecialDayAccent;
  emoji: string;
  /** The day or period the banner is *about*. Equal for a single day. */
  from: string;
  to: string;
  /** Nights until it starts, or null when it is happening today. */
  nights: number | null;
  /** Birthdays only: whose, and which one. */
  person?: { name: string; age: number | null };
  /** School holidays only: how many days off it is, both ends inclusive. */
  days?: number;
};

export type ResolveTodayThemeInput = {
  /** Household-local `YYYY-MM-DD` of the day being shown. */
  dayKey: string;
  /** False while browsing another day — then no countdown is offered. */
  isToday: boolean;
  /** The household, for the one source that is not a function of the calendar. */
  people: readonly BirthdayPerson[];
};

/** The day's theme, or null on the ordinary majority of the year. */
export function resolveTodayTheme({
  dayKey,
  isToday,
  people,
}: ResolveTodayThemeInput): TodayTheme | null {
  const birthday = birthdaysOn(dayKey, people).at(0);
  if (birthday) {
    return {
      source: 'birthday',
      key: 'birthday',
      accent: 'pink',
      emoji: '🎂',
      from: birthday.date,
      to: birthday.date,
      nights: null,
      person: { name: birthday.displayName, age: birthday.age },
    };
  }

  const special = specialDaysOn(dayKey).at(0);
  if (special) {
    return {
      source: 'special',
      key: special.slug,
      accent: special.accent,
      emoji: special.emoji,
      from: special.date,
      to: special.date,
      nights: null,
    };
  }

  const school = schoolHolidayOn(dayKey);
  if (school) {
    return {
      source: 'school',
      key: school.slug,
      accent: school.accent,
      emoji: school.emoji,
      from: school.from,
      to: school.to,
      nights: null,
      days: schoolHolidayLength(school),
    };
  }

  return isToday ? countdownTheme(dayKey, people) : null;
}

/**
 * The nearest of the three countdowns, within the same ten-night window the
 * rest of the slice counts in.
 *
 * Nearest rather than most important: two of these are weeks apart by
 * construction, and when a birthday and a break really do fall in the same
 * fortnight the honest answer is the one that happens first.
 */
function countdownTheme(dayKey: string, people: readonly BirthdayPerson[]): TodayTheme | null {
  const candidates: TodayTheme[] = [];

  const birthday = upcomingBirthday(dayKey, people, COUNTDOWN_NIGHTS);
  if (birthday) {
    candidates.push({
      source: 'birthday',
      key: 'birthday',
      accent: 'pink',
      emoji: '🎂',
      from: birthday.birthday.date,
      to: birthday.birthday.date,
      nights: birthday.nights,
      person: { name: birthday.birthday.displayName, age: birthday.birthday.age },
    });
  }

  const special = upcomingCountdown(dayKey);
  if (special) {
    const definition = SPECIAL_DAYS_NL.find((day) => day.slug === special.slug);
    if (definition) {
      candidates.push({
        source: 'special',
        key: special.slug,
        accent: definition.accent,
        emoji: definition.emoji,
        from: special.date,
        to: special.date,
        nights: special.nights,
      });
    }
  }

  const school = upcomingSchoolHoliday(dayKey, COUNTDOWN_NIGHTS);
  if (school) {
    candidates.push({
      source: 'school',
      key: school.holiday.slug,
      accent: school.holiday.accent,
      emoji: school.holiday.emoji,
      from: school.holiday.from,
      to: school.holiday.to,
      nights: school.nights,
      days: schoolHolidayLength(school.holiday),
    });
  }

  return candidates.sort((left, right) => (left.nights ?? 0) - (right.nights ?? 0)).at(0) ?? null;
}
