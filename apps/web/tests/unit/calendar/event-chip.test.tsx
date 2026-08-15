import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import { EventChip } from '@/modules/calendar/ui/event-chip';
import type { CalendarEvent } from '@/modules/calendar/queries';
import calendarMessages from '../../../messages/en.json';
import dutchMessages from '../../../messages/nl.json';

/**
 * BLOCKING 2 coverage: `EventChip` formats through `useDateTimeFormat()`,
 * which has no zone of its own — it reads whatever `NextIntlClientProvider`'s
 * `timeZone` was given (the household's convention and the timezone are two
 * separate, next-intl-independent-vs-native props now — see
 * `FormattingLocaleProvider`'s doc comment for why formatting locale can't
 * live on `NextIntlClientProvider`'s own `locale`). `(app)/layout.tsx` and
 * `(hub)/layout.tsx` resolve the zone from the family row and pass it down
 * explicitly, instead of letting the *server's* zone (this test runner's
 * container, effectively UTC) leak into what a family reads as the event's
 * wall time.
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
    eventType: 'school',
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

    // `en-GB`, not bare `en`: `EventChip` formats through the household's
    // convention (`FormattingLocaleProvider`), and `en-GB` is what an English
    // household gets by default — bare `en` has no convention of its own and
    // is exactly the ambiguity this split exists to remove.
    const expectedStart = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.startsAt);
    const expectedEnd = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: zone,
    }).format(event.endsAt);

    // Sanity: the New York wall time actually differs from a naive
    // UTC/Amsterdam read of the same instant, so this test would fail if the
    // zone prop were silently ignored.
    const utcStart = new Intl.DateTimeFormat('en-GB', {
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
        <FormattingLocaleProvider formattingLocale="en-GB">
          <EventChip event={event} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

    const chip = screen.getByText('Tandarts').closest('[data-slot="event-chip"]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain(expectedStart);
    expect(chip!.textContent).toContain(expectedEnd);
  });
});

/**
 * The chip used to compare against a locally re-declared `(no title)` literal
 * and had no emptiness check at all; it now asks `titleOf` (`domain/
 * event-title.ts`), which is the one place the three ways an event can reach a
 * surface without a usable name are decided. Dutch, because `calendar.untitled`
 * in English is itself the string "(no title)" — the assertion would pass in
 * English whether or not the sentinel was translated.
 */
describe('EventChip — what an event is called', () => {
  const renderDutch = (event: CalendarEvent) =>
    render(
      <NextIntlClientProvider
        locale="nl"
        timeZone="Europe/Amsterdam"
        messages={{ calendar: dutchMessages.calendar }}
      >
        <FormattingLocaleProvider formattingLocale="nl-NL">
          <EventChip event={event} />
        </FormattingLocaleProvider>
      </NextIntlClientProvider>
    );

  it('translates the sentinel a nameless synced event carries', () => {
    renderDutch(baseEvent({ title: '(no title)' }));
    expect(screen.getByText('(zonder titel)')).toBeTruthy();
  });

  it('names a whitespace-only title untitled rather than drawing a blank chip', () => {
    renderDutch(baseEvent({ title: '   ' }));
    expect(screen.getByText('(zonder titel)')).toBeTruthy();
  });

  it('leaves a real title that merely contains the sentinel alone', () => {
    renderDutch(baseEvent({ title: 'Vergadering (no title) bespreken' }));
    expect(screen.getByText('Vergadering (no title) bespreken')).toBeTruthy();
  });

  it('shows the busy label instead of a redacted event’s stored title', () => {
    renderDutch(baseEvent({ title: 'Therapie', busyOnly: true }));
    expect(screen.getByText('Bezet')).toBeTruthy();
    expect(screen.queryByText('Therapie')).toBeNull();
  });
});
