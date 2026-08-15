import { describe, expect, it } from 'vitest';
import {
  TIME_SECTIONS,
  dateKeyOf,
  instantAt,
  isCompletableOn,
  occurrenceStartOn,
  occurrenceStartsBetween,
  occursOn,
  openOccurrence,
  sectionOf,
  timingAt,
} from '@/modules/routines/domain/occurrence';
import type { Schedule } from '@/modules/routines/domain/schedule';

const ZONE = 'Europe/Amsterdam';

/** A routine created well before every date under test. */
const ANCHOR = new Date('2026-01-05T00:00:00Z');

function input(schedule: Schedule, anchor = ANCHOR) {
  return { schedule, anchor, timeZone: ZONE };
}

const SCHOOL_MORNING: Schedule = {
  rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  timeOfDay: '07:30',
};

describe('which days a routine is due on', () => {
  it('is due on the weekdays its rule names and no others', () => {
    // 2026-03-09 is a Monday.
    expect(occursOn(input(SCHOOL_MORNING), '2026-03-09')).toBe(true);
    expect(occursOn(input(SCHOOL_MORNING), '2026-03-13')).toBe(true);
    expect(occursOn(input(SCHOOL_MORNING), '2026-03-14')).toBe(false);
    expect(occursOn(input(SCHOOL_MORNING), '2026-03-15')).toBe(false);
  });

  it('is not retroactively due for the days before it existed', () => {
    const created = new Date('2026-03-11T09:00:00Z');
    expect(occursOn(input(SCHOOL_MORNING, created), '2026-03-10')).toBe(false);
    // The creation day itself counts, even though 07:30 had already passed:
    // a routine set up over breakfast is a routine for that breakfast.
    expect(occursOn(input(SCHOOL_MORNING, created), '2026-03-11')).toBe(true);
  });

  it('places the occurrence at the schedule time in the family zone', () => {
    const start = occurrenceStartOn(input(SCHOOL_MORNING), '2026-03-09');
    // 07:30 Amsterdam in March (CET, UTC+1) is 06:30Z.
    expect(start?.toISOString()).toBe('2026-03-09T06:30:00.000Z');
  });

  it('keeps the wall clock across a DST boundary', () => {
    // Europe/Amsterdam springs forward on 2026-03-29; 07:30 stays 07:30.
    const before = occurrenceStartOn(
      input({ rrule: 'FREQ=DAILY', timeOfDay: '07:30' }),
      '2026-03-28'
    );
    const after = occurrenceStartOn(
      input({ rrule: 'FREQ=DAILY', timeOfDay: '07:30' }),
      '2026-03-30'
    );

    expect(before?.toISOString()).toBe('2026-03-28T06:30:00.000Z');
    expect(after?.toISOString()).toBe('2026-03-30T05:30:00.000Z');
  });

  it('enumerates a window in order', () => {
    const starts = occurrenceStartsBetween(
      input(SCHOOL_MORNING),
      new Date('2026-03-09T00:00:00Z'),
      new Date('2026-03-16T00:00:00Z')
    );

    expect(starts.map((start) => dateKeyOf(start, ZONE))).toEqual([
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
    ]);
  });

  it('yields nothing — never throws — for a rule it cannot parse', () => {
    expect(
      occurrenceStartsBetween(
        input({ rrule: 'FREQ=NOPE' }),
        new Date('2026-03-09T00:00:00Z'),
        new Date('2026-03-16T00:00:00Z')
      )
    ).toEqual([]);
  });
});

describe('the occurrence a tap satisfies', () => {
  it("is today's when the routine is due today", () => {
    const now = new Date('2026-03-11T08:00:00Z'); // Wednesday, 09:00 local
    expect(openOccurrence(input(SCHOOL_MORNING), now)).toMatchObject({
      occurrenceDate: '2026-03-11',
      daysLate: 0,
    });
  });

  it('is nothing at all on a day the routine is not due and has no grace left', () => {
    const now = new Date('2026-03-14T10:00:00Z'); // Saturday
    expect(openOccurrence(input(SCHOOL_MORNING), now)).toBeNull();
  });

  it('reaches back to the most recent due day inside the grace window', () => {
    const graceful = { ...SCHOOL_MORNING, graceDays: 2 };
    const now = new Date('2026-03-14T10:00:00Z'); // Saturday

    expect(openOccurrence(input(graceful), now)).toMatchObject({
      occurrenceDate: '2026-03-13',
      daysLate: 1,
    });
  });

  it('stops at the edge of the grace window rather than accumulating a backlog', () => {
    const graceful = { ...SCHOOL_MORNING, graceDays: 1 };
    const now = new Date('2026-03-15T10:00:00Z'); // Sunday, two days past Friday

    expect(openOccurrence(input(graceful), now)).toBeNull();
  });

  it('prefers today over an older grace day', () => {
    const graceful = { ...SCHOOL_MORNING, graceDays: 5 };
    const now = new Date('2026-03-12T08:00:00Z'); // Thursday

    expect(openOccurrence(input(graceful), now)).toMatchObject({
      occurrenceDate: '2026-03-12',
      daysLate: 0,
    });
  });
});

describe('what the Server Action will accept', () => {
  const now = new Date('2026-03-12T08:00:00Z'); // Thursday 09:00 local

  it('accepts today', () => {
    expect(isCompletableOn(input(SCHOOL_MORNING), '2026-03-12', now)).toBe(true);
  });

  it('rejects a day the routine was never due on, however plausible', () => {
    expect(isCompletableOn(input(SCHOOL_MORNING), '2026-03-14', now)).toBe(false);
  });

  it('rejects a past due day once grace has run out', () => {
    expect(isCompletableOn(input(SCHOOL_MORNING), '2026-03-11', now)).toBe(false);
    expect(isCompletableOn(input({ ...SCHOOL_MORNING, graceDays: 1 }), '2026-03-11', now)).toBe(
      true
    );
  });

  it('tolerates one day ahead — a hub an hour into tomorrow is not an attack', () => {
    expect(isCompletableOn(input(SCHOOL_MORNING), '2026-03-13', now)).toBe(true);
    expect(isCompletableOn(input(SCHOOL_MORNING), '2026-03-16', now)).toBe(false);
  });
});

describe('how a routine reads on the board', () => {
  it('is upcoming, with whole minutes to go, before its time', () => {
    const now = new Date('2026-03-11T06:00:00Z'); // 07:00 local, 30 min early
    expect(timingAt(input(SCHOOL_MORNING), now)).toMatchObject({
      state: 'upcoming',
      minutesUntil: 30,
    });
  });

  it('is due from its time onwards', () => {
    const now = new Date('2026-03-11T06:30:00Z');
    expect(timingAt(input(SCHOOL_MORNING), now)).toMatchObject({
      state: 'due',
      minutesUntil: null,
    });
  });

  it('is grace — never "missed", never "late" — for an earlier open day', () => {
    const now = new Date('2026-03-14T10:00:00Z');
    const timing = timingAt(input({ ...SCHOOL_MORNING, graceDays: 2 }), now);

    expect(timing.state).toBe('grace');
    expect(timing.occurrence?.occurrenceDate).toBe('2026-03-13');
  });

  it('has no state at all outside its window — absence, not a mark', () => {
    const now = new Date('2026-03-14T10:00:00Z');
    expect(timingAt(input(SCHOOL_MORNING), now)).toEqual({
      state: 'none',
      occurrence: null,
      minutesUntil: null,
    });
  });
});

describe('one-off chores (M20)', () => {
  /** "Clean the garage on Saturday 14 March, 10 stars." */
  const GARAGE: Schedule = { kind: 'once', date: '2026-03-14', timeOfDay: '10:00' };

  it('is due on its day and on no other', () => {
    expect(occursOn(input(GARAGE), '2026-03-14')).toBe(true);
    expect(occursOn(input(GARAGE), '2026-03-13')).toBe(false);
    expect(occursOn(input(GARAGE), '2026-03-15')).toBe(false);
    // Not "every Saturday" — the following one is a different day entirely.
    expect(occursOn(input(GARAGE), '2026-03-21')).toBe(false);
  });

  it('places the occurrence at its time in the family zone', () => {
    expect(occurrenceStartOn(input(GARAGE), '2026-03-14')?.toISOString()).toBe(
      '2026-03-14T09:00:00.000Z'
    );
  });

  it('is not filtered out by an anchor later than its own date', () => {
    // A one-off is not a series with a DTSTART: the date *is* the answer, so a
    // chore created this morning for this afternoon still appears.
    const created = new Date('2026-03-14T08:00:00Z');
    expect(occursOn(input(GARAGE, created), '2026-03-14')).toBe(true);
  });

  it('is absent before its day — a chore for Saturday is not on Thursday’s board', () => {
    const now = new Date('2026-03-12T09:00:00Z');
    expect(timingAt(input(GARAGE), now)).toEqual({
      state: 'none',
      occurrence: null,
      minutesUntil: null,
    });
  });

  it('is upcoming, then due, across its own time of day', () => {
    expect(timingAt(input(GARAGE), new Date('2026-03-14T08:30:00Z'))).toMatchObject({
      state: 'upcoming',
      minutesUntil: 30,
    });
    expect(timingAt(input(GARAGE), new Date('2026-03-14T09:00:00Z'))).toMatchObject({
      state: 'due',
      minutesUntil: null,
    });
  });

  it('stays open through its grace window, as grace and never as a mark', () => {
    const graceful = { ...GARAGE, graceDays: 2 };

    const timing = timingAt(input(graceful), new Date('2026-03-16T09:00:00Z'));
    expect(timing.state).toBe('grace');
    expect(timing.occurrence).toMatchObject({ occurrenceDate: '2026-03-14', daysLate: 2 });
  });

  it('leaves the board once grace has lapsed — absence, not "overdue"', () => {
    const graceful = { ...GARAGE, graceDays: 2 };

    expect(timingAt(input(graceful), new Date('2026-03-17T09:00:00Z'))).toEqual({
      state: 'none',
      occurrence: null,
      minutesUntil: null,
    });
    // And with no grace at all, the day after is already over.
    expect(openOccurrence(input(GARAGE), new Date('2026-03-15T09:00:00Z'))).toBeNull();
  });

  it('accepts a completion on its day, one day early, and inside grace only', () => {
    const graceful = { ...GARAGE, graceDays: 1 };
    const saturday = new Date('2026-03-14T11:00:00Z');

    expect(isCompletableOn(input(graceful), '2026-03-14', saturday)).toBe(true);
    // A hub that is an hour into tomorrow is not an attack (the same tolerance
    // recurring routines get).
    expect(isCompletableOn(input(graceful), '2026-03-14', new Date('2026-03-13T11:00:00Z'))).toBe(
      true
    );
    expect(isCompletableOn(input(graceful), '2026-03-14', new Date('2026-03-15T11:00:00Z'))).toBe(
      true
    );
    expect(isCompletableOn(input(graceful), '2026-03-14', new Date('2026-03-16T11:00:00Z'))).toBe(
      false
    );
    // A forged date the chore was never set for.
    expect(isCompletableOn(input(graceful), '2026-03-15', saturday)).toBe(false);
  });

  it('slots into a board section by its time of day, like any routine', () => {
    expect(sectionOf({ kind: 'once', date: '2026-03-14', timeOfDay: '09:00' })).toBe('morning');
    expect(sectionOf({ kind: 'once', date: '2026-03-14', timeOfDay: '14:00' })).toBe('afternoon');
    expect(sectionOf({ kind: 'once', date: '2026-03-14', timeOfDay: '19:30' })).toBe('evening');
  });

  it('keys its day in the family zone, never in UTC', () => {
    // 23:30 UTC on the 13th is already the 14th in Amsterdam: the chore is
    // due. `toISOString().slice(0, 10)` would still read "2026-03-13" and the
    // board would be empty on the very evening the chore is for.
    const justPastLocalMidnight = new Date('2026-03-13T23:30:00Z');
    expect(dateKeyOf(justPastLocalMidnight, ZONE)).toBe('2026-03-14');
    expect(
      openOccurrence(
        input({ kind: 'once', date: '2026-03-14', timeOfDay: '00:15' }),
        justPastLocalMidnight
      )
    ).toMatchObject({ occurrenceDate: '2026-03-14', daysLate: 0 });

    // The same instant in a zone still on the 13th: not due yet, and absent
    // rather than wrong.
    const westInput = {
      schedule: { kind: 'once' as const, date: '2026-03-14', timeOfDay: '00:15' },
      anchor: ANCHOR,
      timeZone: 'America/New_York',
    };
    expect(openOccurrence(westInput, justPastLocalMidnight)).toBeNull();
  });

  it('survives a DST spring-forward with its wall clock intact', () => {
    // Europe/Amsterdam springs forward on 2026-03-29.
    expect(
      occurrenceStartOn(
        input({ kind: 'once', date: '2026-03-30', timeOfDay: '07:30' }),
        '2026-03-30'
      )?.toISOString()
    ).toBe('2026-03-30T05:30:00.000Z');
  });

  it('is never due when its date is unusable — absence, not a fallback day', () => {
    const broken: Schedule = { kind: 'once', date: '2026-02-30', timeOfDay: '10:00' };
    expect(occursOn(input(broken), '2026-02-30')).toBe(false);
    expect(occursOn(input(broken), '2026-03-02')).toBe(false);
    expect(openOccurrence(input(broken), new Date('2026-03-02T09:00:00Z'))).toBeNull();
  });
});

describe('board sections', () => {
  it('splits the day at noon and 17:00', () => {
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '07:30' })).toBe('morning');
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '11:59' })).toBe('morning');
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '12:00' })).toBe('afternoon');
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '16:59' })).toBe('afternoon');
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '17:00' })).toBe('evening');
    expect(sectionOf({ rrule: 'FREQ=DAILY', timeOfDay: '21:00' })).toBe('evening');
  });

  it('covers every section the board renders', () => {
    expect([...TIME_SECTIONS]).toEqual(['morning', 'afternoon', 'evening']);
  });
});

describe('pinning the board clock', () => {
  it('resolves a date + time in the family zone', () => {
    expect(instantAt('2026-03-11', '07:45', ZONE)?.toISOString()).toBe('2026-03-11T06:45:00.000Z');
  });

  it('falls back to midday when only a date is given', () => {
    expect(instantAt('2026-03-11', undefined, ZONE)?.toISOString()).toBe(
      '2026-03-11T11:00:00.000Z'
    );
  });

  it('is null for anything that is not a real calendar day', () => {
    expect(instantAt('2026-02-30', '07:45', ZONE)).toBeNull();
    expect(instantAt('nope', '07:45', ZONE)).toBeNull();
  });
});
