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
import { fromWall, toWall } from '@/modules/calendar/domain/zone';

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
});
