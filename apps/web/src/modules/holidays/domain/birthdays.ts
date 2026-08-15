/**
 * Birthdays — the one "special day" that is not the same for two households.
 *
 * Every other day this slice knows is a function of the year (`nl.ts`) or a
 * table the government publishes (`school-holidays.ts`). A birthday is a fact
 * about a *person*, so it is the one thing here that takes an argument: the
 * caller hands in the household's people, already loaded for the screen it is
 * rendering, and gets back the same shape the other two sources produce.
 *
 * Pure and framework-free like its neighbours: no query, no `Member` import
 * (the structural `BirthdayPerson` below is the seam), no instants. A birthday
 * is a **date** — you turn seven on the 14th in Amsterdam and on the 14th in
 * Auckland — so this file speaks only `YYYY-MM-DD`, and the caller resolves
 * "today" in the household's timezone before asking.
 */

/** Whatever the caller has that carries a name and a date of birth. */
export type BirthdayPerson = {
  id: string;
  displayName: string;
  /** `YYYY-MM-DD`, or null for the people who never filled it in. */
  birthDate: string | null;
};

/** A person's birthday, placed in a year. */
export type Birthday = {
  id: string;
  displayName: string;
  /** `YYYY-MM-DD` the celebration falls on — see the leap-day note below. */
  date: string;
  /** The age they turn on it, or null when the stored date has no usable year. */
  age: number | null;
};

/** Today's birthdays, in the order the people were given. */
export function birthdaysOn(dateKey: string, people: readonly BirthdayPerson[]): Birthday[] {
  if (!isDateKey(dateKey)) return [];
  const year = Number(dateKey.slice(0, 4));

  return people.flatMap((person) => {
    const celebration = celebrationIn(person.birthDate, year);
    if (celebration !== dateKey) return [];
    return [
      {
        id: person.id,
        displayName: person.displayName,
        date: celebration,
        age: year - Number(person.birthDate!.slice(0, 4)),
      },
    ];
  });
}

/** A birthday coming up, and how many nights away it is. */
export type BirthdayCountdown = { birthday: Birthday; nights: number };

/**
 * The nearest birthday within `nights` of `dateKey`, or null.
 *
 * Checked in `dateKey`'s own year *and* the next, so the last week of December
 * counts towards a birthday in January rather than falling off the end.
 */
export function upcomingBirthday(
  dateKey: string,
  people: readonly BirthdayPerson[],
  nights: number
): BirthdayCountdown | null {
  if (!isDateKey(dateKey)) return null;
  const year = Number(dateKey.slice(0, 4));

  let best: BirthdayCountdown | null = null;

  for (const person of people) {
    for (const candidateYear of [year, year + 1]) {
      const celebration = celebrationIn(person.birthDate, candidateYear);
      if (celebration === null) continue;

      const away = nightsBetween(dateKey, celebration);
      if (away < 1 || away > nights) continue;
      if (best && best.nights <= away) continue;

      best = {
        birthday: {
          id: person.id,
          displayName: person.displayName,
          date: celebration,
          age: candidateYear - Number(person.birthDate!.slice(0, 4)),
        },
        nights: away,
      };
    }
  }

  return best;
}

/**
 * The date a birth date is celebrated on in `year`.
 *
 * 29 February is the only interesting case, and it is celebrated on **28
 * February** in the three years out of four that have no 29th: the birthday
 * stays in the month the child was born in, which is the answer a seven-year-old
 * accepts and 1 March is not. Nothing here ever invents a 29th that does not
 * exist — that is what makes it a rule rather than a `Date` rollover bug.
 */
function celebrationIn(birthDate: string | null, year: number): string | null {
  if (!birthDate || !isDateKey(birthDate)) return null;

  const month = birthDate.slice(5, 7);
  const day = birthDate.slice(8, 10);
  const suffix = month === '02' && day === '29' && !isLeapYear(year) ? '02-28' : `${month}-${day}`;

  return `${String(year).padStart(4, '0')}-${suffix}`;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function nightsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;

  return Math.round((end - start) / 86_400_000);
}
