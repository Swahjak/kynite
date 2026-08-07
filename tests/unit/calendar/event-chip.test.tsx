import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EventChip } from '@/modules/calendar/ui/event-chip';
import type { CalendarEvent } from '@/modules/calendar/queries';
import calendarMessages from '../../../messages/en.json';

/**
 * BLOCKING 2 coverage: `EventChip` formats through `useFormatter()`, which has
 * no zone of its own — it reads whatever `NextIntlClientProvider` was given.
 * `(app)/layout.tsx` and `(hub)/layout.tsx` now resolve that zone from the
 * family row and pass it down explicitly, instead of letting the *server's*
 * zone (this test runner's container, effectively UTC) leak into what a
 * family reads as the event's wall time.
 *
 * The regression this guards against: a family in a zone other than the
 * server's — proven here with `America/New_York`, which is never the CI
 * container's zone — must see the *New York* wall clock on the chip, not
 * whatever the process's local zone happens to render.
 */

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'series-1',
    seriesId: 'series-1',
    title: 'Tandarts',
    description: null,
    location: null,
    startsAt: new Date('2026-01-15T02:30:00.000Z'),
    endsAt: new Date('2026-01-15T03:00:00.000Z'),
    allDay: false,
    tz: 'America/New_York',
    ownerMemberId: null,
    attendeeMemberIds: [],
    eventType: 'appointment',
    category: 'blue',
    calendarId: null,
    calendarSummary: null,
    isRecurringInstance: false,
    recurring: false,
    rrule: null,
    pendingSync: false,
    busyOnly: false,
    editable: true,
    ...overrides,
  };
}

describe('EventChip — timezone-aware formatting (BLOCKING 2)', () => {
  it('renders the wall time of the family zone the provider is given, not the server zone', () => {
    const event = baseEvent();
    const zone = 'America/New_York';

    const expectedStart = new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.startsAt);
    const expectedEnd = new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.endsAt);

    // Sanity: the New York wall time actually differs from a naive
    // UTC/Amsterdam read of the same instant, so this test would fail if the
    // zone prop were silently ignored.
    const utcStart = new Intl.DateTimeFormat('en', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(event.startsAt);
    expect(expectedStart).not.toBe(utcStart);

    render(
      <NextIntlClientProvider
        locale="en"
        timeZone={zone}
        messages={{ calendar: calendarMessages.calendar }}
      >
        <EventChip event={event} />
      </NextIntlClientProvider>
    );

    const chip = screen.getByText('Tandarts').closest('[data-slot="event-chip"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain(expectedStart);
    expect(chip!.textContent).toContain(expectedEnd);
  });
});
