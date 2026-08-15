import { describe, expect, it } from 'vitest';
import { birthdaysOn, upcomingBirthday, type BirthdayPerson } from '@/modules/holidays';

/**
 * D1: a birthday is the one "special day" that is a fact about a person rather
 * than about the calendar, so the cases worth pinning are the ones a naive
 * `new Date(birthDate)` gets wrong — the 29th of February, a household where
 * nobody filled the field in, and the December→January boundary a countdown
 * has to cross.
 */

const people: BirthdayPerson[] = [
  { id: 'mila', displayName: 'Mila', birthDate: '2019-08-14' },
  { id: 'daan', displayName: 'Daan', birthDate: '2021-01-03' },
  { id: 'tom', displayName: 'Tom', birthDate: null },
  { id: 'leap', displayName: 'Loes', birthDate: '2016-02-29' },
];

describe('birthdaysOn', () => {
  it('finds the day and the age turned on it', () => {
    expect(birthdaysOn('2026-08-14', people)).toEqual([
      { id: 'mila', displayName: 'Mila', date: '2026-08-14', age: 7 },
    ]);
  });

  it('is empty on every other day', () => {
    expect(birthdaysOn('2026-08-15', people)).toEqual([]);
  });

  it('ignores people with no date of birth rather than guessing one', () => {
    expect(birthdaysOn('2026-08-14', people).some((b) => b.id === 'tom')).toBe(false);
  });

  it('celebrates a 29 February birthday on the 28th in a common year', () => {
    expect(birthdaysOn('2027-02-28', people).map((b) => b.id)).toEqual(['leap']);
    // …and never invents a 29th that does not exist.
    expect(birthdaysOn('2027-03-01', people)).toEqual([]);
  });

  it('celebrates it on the 29th in a leap year', () => {
    expect(birthdaysOn('2028-02-29', people).map((b) => b.id)).toEqual(['leap']);
    expect(birthdaysOn('2028-02-28', people)).toEqual([]);
  });

  it('is empty for anything that is not a date key', () => {
    expect(birthdaysOn('14 augustus', people)).toEqual([]);
  });
});

describe('upcomingBirthday', () => {
  it('counts nights, and never counts the day itself', () => {
    expect(upcomingBirthday('2026-08-11', people, 10)?.nights).toBe(3);
    expect(upcomingBirthday('2026-08-14', people, 10)).toBeNull();
  });

  it('stays quiet outside the window', () => {
    expect(upcomingBirthday('2026-08-04', people, 10)?.nights).toBe(10);
    expect(upcomingBirthday('2026-08-03', people, 10)).toBeNull();
  });

  it('crosses the year boundary rather than falling off the end of it', () => {
    const found = upcomingBirthday('2026-12-30', people, 10);
    expect(found?.birthday.id).toBe('daan');
    expect(found?.nights).toBe(4);
    // The age is the one he turns *on that day*, in the year it falls in.
    expect(found?.birthday.age).toBe(6);
  });

  it('returns the nearest of two, not the first in the list', () => {
    const two: BirthdayPerson[] = [
      { id: 'far', displayName: 'Far', birthDate: '2015-08-20' },
      { id: 'near', displayName: 'Near', birthDate: '2015-08-16' },
    ];
    expect(upcomingBirthday('2026-08-14', two, 10)?.birthday.id).toBe('near');
  });
});
