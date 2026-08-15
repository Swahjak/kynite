import { describe, expect, it } from 'vitest';
import { holidayEvents } from '@/modules/calendar/domain/holidays';

/**
 * The synthetic side of M26: a speciale dag drawn as a `CalendarEvent` that
 * every existing view already knows how to render, and that no surface can
 * write to.
 *
 * `editable: false` is the assertion that matters. It is the single flag
 * `calendar-shell.tsx` (open the edit dialog), `event-chip.tsx` /
 * `day-agenda-row.tsx` (make the chip a button) and `use-drag-reschedule.ts`
 * (accept a pointer drag) all gate on, so pinning it here pins read-only
 * everywhere at once.
 */

const name = (slug: string) => `name:${slug}`;
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('holidayEvents', () => {
  it('returns the days overlapping the window, and nothing else', () => {
    const events = holidayEvents({ from: utc('2026-12-04'), to: utc('2026-12-07'), name });

    expect(events).toHaveLength(1);
    expect(events[0].key).toBe('holiday:2026-12-05:sinterklaas');
    expect(events[0].title).toBe('name:sinterklaas');
  });

  it('is empty on a window with no special day in it', () => {
    expect(holidayEvents({ from: utc('2026-03-10'), to: utc('2026-03-17'), name })).toEqual([]);
  });

  it('spans the year boundary a week or a padded month view straddles', () => {
    const slugs = holidayEvents({ from: utc('2026-12-30'), to: utc('2027-01-03'), name }).map(
      (event) => event.key
    );

    expect(slugs).toContain('holiday:2026-12-31:newYearsEve');
    expect(slugs).toContain('holiday:2027-01-01:newYear');
  });

  it('draws each day as a one-day, all-day, zone-free event', () => {
    const [event] = holidayEvents({ from: utc('2026-12-25'), to: utc('2026-12-26'), name });

    expect(event.allDay).toBe(true);
    expect(event.tz).toBe('UTC');
    expect(event.startsAt.toISOString()).toBe('2026-12-25T00:00:00.000Z');
    expect(event.endsAt.toISOString()).toBe('2026-12-26T00:00:00.000Z');
  });

  it('is read-only and household-wide, and addresses no database row', () => {
    const [event] = holidayEvents({ from: utc('2026-04-27'), to: utc('2026-04-28'), name });

    expect(event.editable).toBe(false);
    expect(event.householdWide).toBe(true);
    expect(event.calendarId).toBeNull();
    expect(event.ownerMemberId).toBeNull();
    expect(event.attendeeMemberIds).toEqual([]);
    expect(event.pendingSync).toBe(false);
    expect(event.recurring).toBe(false);
    expect(event.isRecurringInstance).toBe(false);
    // The id is the key, so it can never collide with a real (UUID) seriesId.
    expect(event.seriesId).toBe(event.key);
    expect(event.seriesId).toContain(':');
  });

  it('takes its hue from the type taxonomy rather than inventing one', () => {
    const [event] = holidayEvents({ from: utc('2026-05-05'), to: utc('2026-05-06'), name });

    expect(event.eventType).toBe('holiday');
    expect(event.category).toBe('orange');
  });

  it('refuses an inverted or empty window instead of computing a year of nothing', () => {
    expect(holidayEvents({ from: utc('2026-12-26'), to: utc('2026-12-25'), name })).toEqual([]);
    expect(holidayEvents({ from: utc('2026-12-25'), to: utc('2026-12-25'), name })).toEqual([]);
  });
});
