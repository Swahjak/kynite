import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';

// Same boundary stub as `time-grid-layout.test.ts`: `layout()`/`verticalSpan()`
// are pure geometry, but the module they live in imports the drag hook, which
// imports the calendar server actions (`server-only` + the Postgres client).
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
const { APP_GRID_METRICS, HUB_GRID_METRICS, GRID_START_HOUR, HOUR_HEIGHT } =
  await import('@/modules/calendar/ui/tokens');

const TZ = 'Europe/Amsterdam';

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'e1',
    seriesId: 'e1',
    title: 'Zwemles',
    description: null,
    location: null,
    startsAt: new Date('2026-03-11T06:00:00.000Z'), // 07:00 Amsterdam
    endsAt: new Date('2026-03-11T07:00:00.000Z'), // 08:00 Amsterdam
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

describe('grid metrics', () => {
  it('keeps the app surface at 58px/hour by default (unchanged)', () => {
    const eightAm = event({
      startsAt: new Date('2026-03-11T07:00:00.000Z'), // 08:00 Amsterdam
      endsAt: new Date('2026-03-11T08:00:00.000Z'), // 09:00 Amsterdam
    });

    const [positioned] = layout([eightAm], TZ, '2026-03-11');

    expect(positioned.top).toBe((8 - GRID_START_HOUR) * HOUR_HEIGHT);
    expect(APP_GRID_METRICS.hourHeight).toBe(HOUR_HEIGHT);
  });

  it('places an 08:00 event at (8 - startHour) * 84 on the hub surface', () => {
    const eightAm = event({
      startsAt: new Date('2026-03-11T07:00:00.000Z'), // 08:00 Amsterdam
      endsAt: new Date('2026-03-11T08:00:00.000Z'), // 09:00 Amsterdam
    });

    const [positioned] = layout([eightAm], TZ, '2026-03-11', HUB_GRID_METRICS);

    expect(HUB_GRID_METRICS.hourHeight).toBe(84);
    expect(positioned.top).toBe((8 - HUB_GRID_METRICS.startHour) * 84);
    expect(positioned.height).toBe(84);
  });

  it('keeps the 06–23 hour range on both surfaces (decision: hub day is not shorter)', () => {
    expect(HUB_GRID_METRICS.startHour).toBe(APP_GRID_METRICS.startHour);
    expect(HUB_GRID_METRICS.endHour).toBe(APP_GRID_METRICS.endHour);
  });

  it('clamps an early block to the top of the grid using the hub row height', () => {
    const earlyRun = event({
      startsAt: new Date('2026-03-11T04:00:00.000Z'), // 05:00 Amsterdam
      endsAt: new Date('2026-03-11T06:00:00.000Z'), // 07:00 Amsterdam
    });

    const [positioned] = layout([earlyRun], TZ, '2026-03-11', HUB_GRID_METRICS);

    expect(positioned.top).toBe(0);
    expect(positioned.height).toBe(84);
    expect(positioned.continuesBefore).toBe(true);
  });
});
