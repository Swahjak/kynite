import { describe, expect, it } from 'vitest';

import { resolveCategory, nearestCategory } from '@/modules/calendar/domain/category';
import {
  CALENDAR_VIEWS,
  daysOf,
  fetchWindow,
  isCalendarView,
  shiftAnchor,
  viewWindow,
} from '@/modules/calendar/domain/window';
import { fromWall, MS_PER_DAY, MS_PER_HOUR, toWall } from '@/modules/calendar/domain/zone';

const AMSTERDAM = 'Europe/Amsterdam';

/** Wednesday 11 March 2026, 14:00 Amsterdam. */
const ANCHOR = new Date('2026-03-11T13:00:00.000Z');
const options = { anchor: ANCHOR, timeZone: AMSTERDAM, weekStartsOn: 1 };

function localDay(instant: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: AMSTERDAM }).format(instant);
}

describe('viewWindow', () => {
  it('day spans exactly the anchor day', () => {
    const { from, to } = viewWindow('day', options);

    expect(localDay(from)).toBe('2026-03-11');
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-03-11');
  });

  it('week runs Monday to Sunday under weekStartsOn = 1', () => {
    const { from, to } = viewWindow('week', options);

    expect(localDay(from)).toBe('2026-03-09');
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-03-15');
  });

  it('week follows a Sunday-first family', () => {
    const { from } = viewWindow('week', { ...options, weekStartsOn: 7 });
    expect(localDay(from)).toBe('2026-03-08');
  });

  it('month pads to whole weeks so the grid is never ragged', () => {
    const { from, to } = viewWindow('month', options);

    // 1 March 2026 is a Sunday, so a Monday-first grid opens on 23 February.
    expect(localDay(from)).toBe('2026-02-23');
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-04-05');

    expect(daysOf('month', options).length % 7).toBe(0);
  });

  it('agenda runs 30 days from the anchor', () => {
    const { from, to } = viewWindow('agenda', options);

    expect(localDay(from)).toBe('2026-03-11');
    expect(daysOf('agenda', options)).toHaveLength(30);
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-04-09');
  });

  it('starts every window at local midnight', () => {
    for (const view of CALENDAR_VIEWS) {
      const wall = toWall(viewWindow(view, options).from, AMSTERDAM);
      expect([wall.hour, wall.minute, wall.second]).toEqual([0, 0, 0]);
    }
  });
});

describe('viewWindow — DST boundaries (BLOCKING 3)', () => {
  const NEW_YORK = 'America/New_York';

  it('a week spanning the Amsterdam spring-forward (2026-03-29, 23h day) stays 7 wall days', () => {
    // Sunday 29 March 2026 is the night Amsterdam clocks jump 02:00 → 03:00.
    // Anchoring mid-week keeps the assertion about the *week*, not about
    // which day the anchor happens to land on.
    const anchor = new Date('2026-03-25T10:00:00.000Z'); // Wednesday, well inside the week
    const springOptions = { anchor, timeZone: AMSTERDAM, weekStartsOn: 1 };

    const { from, to } = viewWindow('week', springOptions);
    const days = daysOf('week', springOptions);

    expect(localDay(from)).toBe('2026-03-23'); // Monday
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-03-29'); // Sunday

    // Every window still starts at local midnight, DST or not.
    for (const day of days) {
      const wall = toWall(day, AMSTERDAM);
      expect([wall.hour, wall.minute, wall.second]).toEqual([0, 0, 0]);
    }

    // Day count is unaffected by the lost hour: 7 wall days, correct wall
    // dates, even though the *elapsed* span is only 167 hours.
    expect(days).toHaveLength(7);
    expect(days.map((day) => localDay(day))).toEqual([
      '2026-03-23',
      '2026-03-24',
      '2026-03-25',
      '2026-03-26',
      '2026-03-27',
      '2026-03-28',
      '2026-03-29',
    ]);

    // The instant span is 7×24h minus the lost hour — proof the window is
    // built from wall-clock arithmetic, not from a naive 7×86 400 000 ms add.
    const sevenDays = 7 * MS_PER_DAY;
    expect(to.getTime() - from.getTime()).toBe(sevenDays - MS_PER_HOUR);
  });

  it('a week spanning the Amsterdam autumn-back (2026-10-25, 25h day) stays 7 wall days', () => {
    // Sunday 25 October 2026: clocks fall back 03:00 → 02:00, a 25-hour day.
    const anchor = new Date('2026-10-21T10:00:00.000Z'); // Wednesday
    const autumnOptions = { anchor, timeZone: AMSTERDAM, weekStartsOn: 1 };

    const { from, to } = viewWindow('week', autumnOptions);
    const days = daysOf('week', autumnOptions);

    expect(localDay(from)).toBe('2026-10-19'); // Monday
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-10-25'); // Sunday
    expect(days).toHaveLength(7);
    expect(days.map((day) => localDay(day))).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);

    for (const day of days) {
      const wall = toWall(day, AMSTERDAM);
      expect([wall.hour, wall.minute, wall.second]).toEqual([0, 0, 0]);
    }

    // The extra hour shows up as 7×24h *plus* one, the mirror of the spring
    // case above.
    const sevenDays = 7 * MS_PER_DAY;
    expect(to.getTime() - from.getTime()).toBe(sevenDays + MS_PER_HOUR);
  });

  it('weekStartsOn = 7 (Sunday-first) still finds the right week through the spring-forward transition', () => {
    // Anchor is the transition day itself, under a Sunday-first family. A
    // Sunday-first week containing 2026-03-29 runs 2026-03-29 → 2026-04-04 —
    // the transition day becomes the *first* day of the week rather than the
    // last, which exercises `weekStart()`'s own DST arithmetic from the other
    // side.
    const anchor = new Date('2026-03-29T10:00:00.000Z');
    const options7 = { anchor, timeZone: AMSTERDAM, weekStartsOn: 7 };

    const { from, to } = viewWindow('week', options7);
    const days = daysOf('week', options7);

    expect(localDay(from)).toBe('2026-03-29');
    expect(localDay(new Date(to.getTime() - 1))).toBe('2026-04-04');
    expect(days).toHaveLength(7);
    expect(days.map((day) => localDay(day))).toEqual([
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
    ]);

    const sevenDays = 7 * MS_PER_DAY;
    expect(to.getTime() - from.getTime()).toBe(sevenDays - MS_PER_HOUR);
  });

  it('a non-Amsterdam zone (America/New_York, 2026-03-08 spring-forward) parameterizes correctly', () => {
    const localDayNY = (instant: Date): string =>
      new Intl.DateTimeFormat('sv-SE', { timeZone: NEW_YORK }).format(instant);

    // Sunday 8 March 2026: US clocks jump 02:00 → 03:00 — a different date
    // than Amsterdam's, proof the DST table is read per-zone, not hardcoded.
    const anchor = new Date('2026-03-04T10:00:00.000Z'); // Wednesday
    const nyOptions = { anchor, timeZone: NEW_YORK, weekStartsOn: 1 };

    const { from, to } = viewWindow('week', nyOptions);
    const days = daysOf('week', nyOptions);

    expect(localDayNY(from)).toBe('2026-03-02'); // Monday
    expect(localDayNY(new Date(to.getTime() - 1))).toBe('2026-03-08'); // Sunday
    expect(days).toHaveLength(7);
    expect(days.map((day) => localDayNY(day))).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);

    for (const day of days) {
      const wall = toWall(day, NEW_YORK);
      expect([wall.hour, wall.minute, wall.second]).toEqual([0, 0, 0]);
    }

    const sevenDays = 7 * MS_PER_DAY;
    expect(to.getTime() - from.getTime()).toBe(sevenDays - MS_PER_HOUR);
  });
});

describe('fetchWindow', () => {
  it('covers every view, so switching views needs no refetch', () => {
    const fetched = fetchWindow(options);

    for (const view of CALENDAR_VIEWS) {
      const window = viewWindow(view, options);
      expect(fetched.from.getTime()).toBeLessThanOrEqual(window.from.getTime());
      expect(fetched.to.getTime()).toBeGreaterThanOrEqual(window.to.getTime());
    }
  });
});

describe('shiftAnchor', () => {
  it('steps a day, a week and 30 agenda days', () => {
    expect(localDay(shiftAnchor('day', options, 1))).toBe('2026-03-12');
    expect(localDay(shiftAnchor('day', options, -1))).toBe('2026-03-10');
    expect(localDay(shiftAnchor('week', options, 1))).toBe('2026-03-18');
    expect(localDay(shiftAnchor('agenda', options, 1))).toBe('2026-04-10');
  });

  it('cannot skip a month when stepping off a 31st', () => {
    // Naively adding a month to 31 January lands in March. Anchoring to the
    // 1st is what keeps February reachable.
    const january31 = fromWall(
      { year: 2026, month: 1, day: 31, hour: 12, minute: 0, second: 0 },
      AMSTERDAM
    );

    const next = shiftAnchor('month', { ...options, anchor: january31 }, 1);
    expect(localDay(next)).toBe('2026-02-01');
  });

  it('round-trips forward and back', () => {
    const forward = shiftAnchor('month', options, 1);
    const back = shiftAnchor('month', { ...options, anchor: forward }, -1);
    expect(localDay(back)).toBe('2026-03-01');
  });
});

describe('isCalendarView', () => {
  it('accepts the four views and nothing else', () => {
    for (const view of CALENDAR_VIEWS) expect(isCalendarView(view)).toBe(true);
    expect(isCalendarView('year')).toBe(false);
    expect(isCalendarView(undefined)).toBe(false);
  });
});

describe('category resolution', () => {
  it('prefers the per-event override', () => {
    expect(resolveCategory({ category: 'pink', calendarColor: '#3b82f6' })).toBe('pink');
  });

  it('falls back to the calendar color, mapped onto the palette', () => {
    expect(resolveCategory({ category: null, calendarColor: '#3f51b5' })).toBe('blue');
    expect(resolveCategory({ category: null, calendarColor: '#0b8043' })).toBe('green');
  });

  it('always returns a color, so no view has to handle a colorless event', () => {
    expect(resolveCategory({ category: null, calendarColor: null })).toBe('blue');
    expect(resolveCategory({ category: null, calendarColor: 'not-a-color' })).toBe('blue');
  });

  it('maps each palette color to itself', () => {
    expect(nearestCategory('#a855f7')).toBe('purple');
    expect(nearestCategory('#14b8a6')).toBe('teal');
    expect(nearestCategory('#eab308')).toBe('yellow');
  });

  // BLOCKING B-2: the per-calendar colour rung (`calendarCategory`, PRD FR28,
  // M16) sits between the per-event override and Google's raw hex — untested
  // before this, which is how a whole rung of `resolveCategory` could be
  // deleted with every existing test still green.
  it('prefers the per-event override over the calendar override', () => {
    expect(
      resolveCategory({ category: 'pink', calendarCategory: 'green', calendarColor: '#3b82f6' })
    ).toBe('pink');
  });

  it('prefers the calendar override over the Google hex', () => {
    expect(
      resolveCategory({ category: null, calendarCategory: 'green', calendarColor: '#3b82f6' })
    ).toBe('green');
  });

  it('falls back to the Google hex when neither override is set', () => {
    expect(
      resolveCategory({ category: null, calendarCategory: null, calendarColor: '#3f51b5' })
    ).toBe('blue');
  });
});
