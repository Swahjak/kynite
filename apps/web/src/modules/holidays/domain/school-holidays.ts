/**
 * The Dutch school holidays — the five *periods* a family's year is shaped by.
 *
 * `nl.ts` next door answers "is today a special day"; this file answers the
 * question a period asks instead: "are we *in* the summer holiday", which is
 * true for six weeks and is the single biggest fact about a household's day
 * during them. Same rules as its neighbour — pure, framework-free, `YYYY-MM-DD`
 * in and out, no schema, no fetch, no instants.
 *
 * ## Why a table and not arithmetic
 *
 * A special day is arithmetic: 25 December is a function of the year. A school
 * holiday is **not**. The Rijksoverheid publishes the dates per school year and
 * per region (noord / midden / zuid), the spring and summer weeks rotate
 * between the regions on a schedule that is a policy rather than a formula, and
 * the May holiday is an *advice* schools may take or leave. There is no
 * computus to write; there is a table to copy, so this file copies it.
 *
 * That has one honest consequence, stated here rather than discovered later:
 * **the table runs out.** Outside the school years below every query returns
 * nothing, which on the screen means the banner simply does not appear — the
 * failure mode of a missing row, never a wrong date. Extending it is a
 * five-line edit once a year, from
 * https://www.rijksoverheid.nl/onderwerpen/schoolvakanties.
 *
 * ## Why only regio zuid
 *
 * Because a region is a *household setting*, and there is no settings screen
 * for it yet. Shipping one region and a seam is the smaller lie than shipping a
 * picker nobody has been asked for: the type below already carries `region`, so
 * the day a household can choose gets a column and a `where`, not a rewrite.
 * Zuid is the product's own home region.
 */

/**
 * The five holidays, in the order a Dutch school year meets them.
 *
 * Each is a message key: `holidays.school.<slug>` (the name),
 * `holidays.banner.<slug>` (the headline) and `holidays.metaSuffix.<slug>` (the
 * line under it) in `messages/nl.json` and `messages/en.json`.
 */
export const SCHOOL_HOLIDAY_SLUGS = [
  'autumnBreak',
  'christmasBreak',
  'springBreak',
  'mayBreak',
  'summerBreak',
] as const;

export type SchoolHolidaySlug = (typeof SCHOOL_HOLIDAY_SLUGS)[number];

/** The three Dutch holiday regions. Only `south` has rows; see the header. */
export type SchoolRegion = 'north' | 'middle' | 'south';

export const DEFAULT_SCHOOL_REGION: SchoolRegion = 'south';

/** The eight category hues, by name — the same local union `nl.ts` declares. */
export type SchoolHolidayAccent =
  'blue' | 'purple' | 'orange' | 'green' | 'red' | 'yellow' | 'pink' | 'teal';

export type SchoolHoliday = {
  slug: SchoolHolidaySlug;
  /** First day of the break, inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Last day of the break, inclusive — a break ends on a Sunday, not before it. */
  to: string;
  region: SchoolRegion;
  accent: SchoolHolidayAccent;
  /** No icon-font glyph is guaranteed; the emoji is the tile's floor. */
  emoji: string;
};

/**
 * Hue and glyph per holiday, kept apart from the dates so the table below is
 * only ever dates — the part that is copied from a government page every year
 * and the part that is a design decision should not be edited in the same
 * breath.
 *
 * The hues are the design sheet's own grounds: the spring break is green, the
 * May break the same green a step warmer (yellow), the summer break the sea's
 * blue, the autumn break orange and the Christmas break the winter blue the
 * sheet draws snow on.
 */
const LOOK: Record<SchoolHolidaySlug, { accent: SchoolHolidayAccent; emoji: string }> = {
  autumnBreak: { accent: 'orange', emoji: '🍂' },
  christmasBreak: { accent: 'blue', emoji: '❄️' },
  springBreak: { accent: 'green', emoji: '🌷' },
  mayBreak: { accent: 'yellow', emoji: '🌳' },
  summerBreak: { accent: 'teal', emoji: '🏖️' },
};

/**
 * The published dates, regio zuid, by school year.
 *
 * Source: Rijksoverheid's schoolvakanties tables. Rows are `[from, to]`,
 * inclusive at both ends, in the order the school year meets them. Copy the
 * next year in when it is published; nothing else here changes.
 */
const SOUTH_BY_SCHOOL_YEAR: Record<string, Record<SchoolHolidaySlug, [string, string]>> = {
  '2025/2026': {
    autumnBreak: ['2025-10-25', '2025-11-02'],
    christmasBreak: ['2025-12-20', '2026-01-04'],
    springBreak: ['2026-02-14', '2026-02-22'],
    mayBreak: ['2026-04-25', '2026-05-03'],
    summerBreak: ['2026-07-11', '2026-08-23'],
  },
  '2026/2027': {
    autumnBreak: ['2026-10-17', '2026-10-25'],
    christmasBreak: ['2026-12-19', '2027-01-03'],
    springBreak: ['2027-02-13', '2027-02-21'],
    mayBreak: ['2027-04-24', '2027-05-02'],
    summerBreak: ['2027-07-10', '2027-08-22'],
  },
  '2027/2028': {
    autumnBreak: ['2027-10-16', '2027-10-24'],
    christmasBreak: ['2027-12-25', '2028-01-09'],
    springBreak: ['2028-02-26', '2028-03-05'],
    mayBreak: ['2028-04-22', '2028-04-30'],
    summerBreak: ['2028-07-08', '2028-08-20'],
  },
};

/**
 * Every school holiday the table knows, flattened and sorted by start date.
 *
 * Computed once: the table is a constant, so re-deriving it per request would
 * be work with no possible new answer.
 */
const ALL: readonly SchoolHoliday[] = Object.values(SOUTH_BY_SCHOOL_YEAR)
  .flatMap((year) =>
    SCHOOL_HOLIDAY_SLUGS.map((slug) => ({
      slug,
      from: year[slug][0],
      to: year[slug][1],
      region: DEFAULT_SCHOOL_REGION,
      accent: LOOK[slug].accent,
      emoji: LOOK[slug].emoji,
    }))
  )
  .sort((left, right) => left.from.localeCompare(right.from));

/** Every school holiday overlapping `year`, in calendar order. */
export function schoolHolidays(year: number, region: SchoolRegion = DEFAULT_SCHOOL_REGION) {
  const prefix = String(year).padStart(4, '0');
  return ALL.filter(
    (holiday) =>
      holiday.region === region &&
      (holiday.from.startsWith(prefix) || holiday.to.startsWith(prefix))
  );
}

/**
 * The school holiday `dateKey` falls inside, or null.
 *
 * Never a list: the five periods cannot overlap by construction (a school year
 * has one of each and they are weeks apart), so unlike `specialDaysOn` there is
 * no collision to hand upward.
 */
export function schoolHolidayOn(
  dateKey: string,
  region: SchoolRegion = DEFAULT_SCHOOL_REGION
): SchoolHoliday | null {
  if (!isDateKey(dateKey)) return null;

  return (
    ALL.find(
      (holiday) => holiday.region === region && holiday.from <= dateKey && dateKey <= holiday.to
    ) ?? null
  );
}

/** A break that has not started yet, and how many nights away it is. */
export type SchoolHolidayCountdown = {
  holiday: SchoolHoliday;
  /** 1…`nights`. Never 0 — day one of the break is the break, not a countdown. */
  nights: number;
};

/**
 * The break starting within `nights` of `dateKey`, or null.
 *
 * Same unit and the same reasoning as `upcomingCountdown` next door: nights,
 * because "nog 3 nachtjes" survives being read at 21:00 where "over 3 dagen"
 * quietly stops being true after lunch.
 */
export function upcomingSchoolHoliday(
  dateKey: string,
  nights: number,
  region: SchoolRegion = DEFAULT_SCHOOL_REGION
): SchoolHolidayCountdown | null {
  if (!isDateKey(dateKey)) return null;

  for (const holiday of ALL) {
    if (holiday.region !== region) continue;
    const away = nightsBetween(dateKey, holiday.from);
    if (away < 1 || away > nights) continue;
    return { holiday, nights: away };
  }

  return null;
}

/** How many days long a break is, both ends inclusive — "9 dagen vrij". */
export function schoolHolidayLength(holiday: SchoolHoliday): number {
  return nightsBetween(holiday.from, holiday.to) + 1;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Dates only, so UTC is exact. */
function nightsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;

  return Math.round((end - start) / 86_400_000);
}
