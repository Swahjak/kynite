import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';

// The grid module imports the drag hook, which imports the calendar server
// actions (`server-only` + the Postgres client). `layout()` is pure geometry
// and touches none of it, so the boundary is stubbed rather than a database
// stood up for an arithmetic test.
vi.mock('@/modules/calendar/actions', () => ({
  rescheduleEventAction: vi.fn(),
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const { layoutForTests: layout } = await import('@/modules/calendar/ui/time-grid');
const { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT } =
  await import('@/modules/calendar/ui/tokens');

const TZ = 'Europe/Amsterdam';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'e1',
    seriesId: 'e1',
    title: 'Nachtdienst',
    description: null,
    location: null,
    startsAt: new Date('2026-03-11T09:00:00.000Z'),
    endsAt: new Date('2026-03-11T10:00:00.000Z'),
    allDay: false,
    tz: TZ,
    ownerMemberId: null,
    attendeeMemberIds: [],
    eventType: 'other',
    category: 'purple',
    calendarId: null,
    calendarSummary: null,
    isRecurringInstance: false,
    recurring: false,
    rrule: null,
    pendingSync: false,
    householdWide: false,
    busyOnly: false,
    editable: true,
    ...overrides,
  };
}

/** Pixel offset of a wall-clock hour inside the rendered grid. */
const atHour = (hour: number) => (hour - GRID_START_HOUR) * HOUR_HEIGHT;

/**
 * The vertical span is **day-relative**, which is the whole point: a block is an
 * interval, and the grid draws one day of it at a time.
 */
describe('time-grid layout()', () => {
  // 22:00 → 02:00 in Amsterdam, in March (CET, UTC+1).
  const nightShift = event({
    startsAt: new Date('2026-03-11T21:00:00.000Z'),
    endsAt: new Date('2026-03-12T01:00:00.000Z'),
  });

  it('draws a midnight-spanning block from its start to the bottom of the first day', () => {
    const [positioned] = layout([nightShift], TZ, '2026-03-11');

    expect(positioned.top).toBe(atHour(22));
    // Clamped at the last rendered hour, and marked as running past it.
    expect(positioned.height).toBe((GRID_END_HOUR - 22) * HOUR_HEIGHT);
    expect(positioned.continuesAfter).toBe(true);
    expect(positioned.continuesBefore).toBe(false);
  });

  it('draws the same block at the top of the second day, not back at 22:00', () => {
    const [positioned] = layout([nightShift], TZ, '2026-03-12');

    // The bug: `minutesIntoDay(startsAt)` is 22:00 whatever day is rendered, so
    // the second day drew the block in the evening again — the wrong day
    // entirely. Day two begins at the top of the grid.
    expect(positioned.top).toBe(0);
    expect(positioned.top).not.toBe(atHour(22));
    expect(positioned.continuesBefore).toBe(true);
    expect(positioned.continuesAfter).toBe(false);
  });

  it('ends a block at the bottom when it stops at midnight exactly', () => {
    const untilMidnight = event({
      startsAt: new Date('2026-03-11T21:00:00.000Z'), // 22:00
      endsAt: new Date('2026-03-11T23:00:00.000Z'), // 00:00 the next day
    });

    const [positioned] = layout([untilMidnight], TZ, '2026-03-11');

    expect(positioned.top).toBe(atHour(22));
    expect(positioned.continuesAfter).toBe(true);
  });

  it('clamps a block starting before the first rendered hour instead of floating above the grid', () => {
    const earlyRun = event({
      startsAt: new Date('2026-03-11T04:00:00.000Z'), // 05:00
      endsAt: new Date('2026-03-11T06:00:00.000Z'), // 07:00
    });

    const [positioned] = layout([earlyRun], TZ, '2026-03-11');

    expect(positioned.top).toBe(0);
    expect(positioned.height).toBe(HOUR_HEIGHT);
    expect(positioned.continuesBefore).toBe(true);
  });

  it('still splits overlapping blocks between the columns of one day', () => {
    const school = event({
      key: 'school',
      startsAt: new Date('2026-03-11T08:00:00.000Z'),
      endsAt: new Date('2026-03-11T13:00:00.000Z'),
    });
    const dentist = event({
      key: 'dentist',
      startsAt: new Date('2026-03-11T09:00:00.000Z'),
      endsAt: new Date('2026-03-11T09:30:00.000Z'),
    });

    const positioned = layout([school, dentist], TZ, '2026-03-11');

    expect(positioned.map((entry) => entry.columnCount)).toEqual([2, 2]);
    expect(positioned.map((entry) => entry.columnIndex)).toEqual([0, 1]);
  });

  it('reuses a freed column instead of waterfalling disjoint short events sideways', () => {
    // The reported bug: one long event plus several short, non-overlapping
    // ones. Every short event followed the previous one only in start time,
    // never in overlap, so each opened its own column — 7 columns wide for a
    // day with a single genuine overlap (the long event against each short
    // one). They should all share column 1 instead.
    const long = event({
      key: 'long',
      startsAt: new Date('2026-03-11T06:00:00.000Z'), // 07:00
      endsAt: new Date('2026-03-11T18:00:00.000Z'), // 19:00
    });
    const short08 = event({
      key: 'short08',
      startsAt: new Date('2026-03-11T07:00:00.000Z'), // 08:00
      endsAt: new Date('2026-03-11T07:30:00.000Z'),
    });
    const short10 = event({
      key: 'short10',
      startsAt: new Date('2026-03-11T09:00:00.000Z'), // 10:00
      endsAt: new Date('2026-03-11T09:30:00.000Z'),
    });
    const short13 = event({
      key: 'short13',
      startsAt: new Date('2026-03-11T12:00:00.000Z'), // 13:00
      endsAt: new Date('2026-03-11T12:30:00.000Z'),
    });
    const short14 = event({
      key: 'short14',
      startsAt: new Date('2026-03-11T13:00:00.000Z'), // 14:00
      endsAt: new Date('2026-03-11T13:30:00.000Z'),
    });

    const positioned = layout([long, short08, short10, short13, short14], TZ, '2026-03-11');
    const byKey = new Map(positioned.map((entry) => [entry.event.key, entry]));

    expect(positioned.every((entry) => entry.columnCount === 2)).toBe(true);
    expect(byKey.get('long')!.columnIndex).toBe(0);
    expect(byKey.get('short08')!.columnIndex).toBe(1);
    expect(byKey.get('short10')!.columnIndex).toBe(1);
    expect(byKey.get('short13')!.columnIndex).toBe(1);
    expect(byKey.get('short14')!.columnIndex).toBe(1);
  });

  it('opens a third column for a genuine three-way overlap', () => {
    const a = event({
      key: 'a',
      startsAt: new Date('2026-03-11T08:00:00.000Z'),
      endsAt: new Date('2026-03-11T10:00:00.000Z'),
    });
    const b = event({
      key: 'b',
      startsAt: new Date('2026-03-11T08:30:00.000Z'),
      endsAt: new Date('2026-03-11T09:30:00.000Z'),
    });
    const c = event({
      key: 'c',
      startsAt: new Date('2026-03-11T09:00:00.000Z'),
      endsAt: new Date('2026-03-11T09:15:00.000Z'),
    });

    const positioned = layout([a, b, c], TZ, '2026-03-11');
    const byKey = new Map(positioned.map((entry) => [entry.event.key, entry]));

    expect(positioned.every((entry) => entry.columnCount === 3)).toBe(true);
    expect(byKey.get('a')!.columnIndex).toBe(0);
    expect(byKey.get('b')!.columnIndex).toBe(1);
    expect(byKey.get('c')!.columnIndex).toBe(2);
  });

  it('lets a touching event share a column instead of opening a new one', () => {
    const first = event({
      key: 'first',
      startsAt: new Date('2026-03-11T09:00:00.000Z'), // 10:00
      endsAt: new Date('2026-03-11T10:00:00.000Z'), // 11:00
    });
    const second = event({
      key: 'second',
      startsAt: new Date('2026-03-11T10:00:00.000Z'), // 11:00 — touches, doesn't overlap
      endsAt: new Date('2026-03-11T11:00:00.000Z'), // 12:00
    });

    const positioned = layout([first, second], TZ, '2026-03-11');
    const byKey = new Map(positioned.map((entry) => [entry.event.key, entry]));

    expect(positioned.every((entry) => entry.columnCount === 1)).toBe(true);
    expect(byKey.get('first')!.columnIndex).toBe(0);
    expect(byKey.get('second')!.columnIndex).toBe(0);
  });
});
