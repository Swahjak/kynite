import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import { PersonColumns } from '@/modules/calendar/ui/person-columns';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';
import messages from '../../../messages/nl.json';

/**
 * The per-person board's split, which is now `splitByMember`
 * (`domain/day-board.ts`) rather than a loop of its own. Two of the rules it
 * pins were *not* what this board did before, and both are visible on the
 * kitchen wall:
 *
 * - an event attributed only to people this board does not render is dropped,
 *   where the board used to promote it into the shared "Iedereen" block;
 * - all-day rows lead a column, where the board used to sort by `startsAt`
 *   alone and therefore placed them by the accident of a UTC midnight.
 *
 * Dutch messages throughout: `calendar.untitled` in English is the literal
 * "(no title)", so a title assertion in English proves nothing.
 */

const TZ = 'Europe/Amsterdam';
const DAY = new Date('2026-03-10T12:00:00.000Z');

function member(id: string, displayName: string, sortOrder: number): Member {
  return {
    id,
    familyId: 'family-1',
    displayName,
    role: 'child',
    color: 'blue',
    avatarUrl: null,
    sortOrder,
    birthday: null,
    starBalance: 0,
  } as unknown as Member;
}

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    key: 'e1',
    seriesId: 'e1',
    title: 'Tandarts',
    description: null,
    location: null,
    startsAt: new Date('2026-03-10T09:00:00.000Z'),
    endsAt: new Date('2026-03-10T10:00:00.000Z'),
    allDay: false,
    tz: TZ,
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

function renderBoard(members: Member[], events: CalendarEvent[]) {
  return render(
    <NextIntlClientProvider locale="nl" timeZone={TZ} messages={{ calendar: messages.calendar }}>
      <FormattingLocaleProvider formattingLocale="nl-NL">
        <PersonColumns members={members} events={events} timeZone={TZ} day={DAY} now={null} />
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

describe('PersonColumns', () => {
  const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

  it('puts an owned event in its owner’s column only', () => {
    const { container } = renderBoard(members, [event({ ownerMemberId: 'm1' })]);

    const columns = container.querySelectorAll('[data-slot="member-column"]');
    expect(columns[0].querySelectorAll('[data-slot="day-agenda-row"]')).toHaveLength(1);
    expect(columns[1].querySelectorAll('[data-slot="day-agenda-row"]')).toHaveLength(0);
    expect(container.querySelector('[data-slot="shared-events"]')).toBeNull();
  });

  it('shares an event nobody is attached to', () => {
    const { container } = renderBoard(members, [event({ title: 'Opa en oma komen' })]);

    const block = container.querySelector('[data-slot="shared-events"]')!;
    expect(block.textContent).toContain('Opa en oma komen');
  });

  it('shares a household event even when attribution names one member', () => {
    const { container } = renderBoard(members, [
      event({ title: 'Familiediner', householdWide: true, ownerMemberId: 'm1' }),
    ]);

    expect(container.querySelector('[data-slot="shared-events"]')!.textContent).toContain(
      'Familiediner'
    );
    expect(screen.getAllByText('Familiediner')).toHaveLength(1);
  });

  /**
   * The privacy rule. The shared block is captioned "Iedereen" and spans the
   * whole family, so an event whose only participants are members this board
   * does not render — a soft-deleted member, or one a parent unticked — must
   * not fall through into it. This board used to promote exactly that.
   */
  it('drops an event attributed only to members it does not render', () => {
    const { container } = renderBoard(members, [
      event({ title: 'Sollicitatiegesprek', ownerMemberId: 'left-the-family' }),
    ]);

    expect(screen.queryByText('Sollicitatiegesprek')).toBeNull();
    expect(container.querySelector('[data-slot="shared-events"]')).toBeNull();
  });

  it('still renders the visible half of a partly hidden event', () => {
    const { container } = renderBoard(members, [
      event({ title: 'Uitje', ownerMemberId: 'gone', attendeeMemberIds: ['m1'] }),
    ]);

    const mila = container.querySelector('[data-slot="member-column"][data-member-id="m1"]')!;
    expect(mila.textContent).toContain('Uitje');
    expect(container.querySelector('[data-slot="shared-events"]')).toBeNull();
  });

  /**
   * An all-day row is stored as a UTC midnight, which in Amsterdam sorts as
   * 01:00 — after a 00:30 event and before breakfast, a position nobody chose.
   * It frames the day, so it leads the column.
   */
  it('leads a column with the all-day row rather than sorting it by its stored midnight', () => {
    const { container } = renderBoard(members, [
      event({
        key: 'nacht',
        seriesId: 'nacht',
        title: 'Nachtdienst',
        ownerMemberId: 'm1',
        startsAt: new Date('2026-03-09T23:30:00.000Z'),
        endsAt: new Date('2026-03-10T01:00:00.000Z'),
      }),
      event({
        key: 'vrij',
        seriesId: 'vrij',
        title: 'Vrije dag',
        ownerMemberId: 'm1',
        allDay: true,
        startsAt: new Date('2026-03-10T00:00:00.000Z'),
        endsAt: new Date('2026-03-11T00:00:00.000Z'),
      }),
    ]);

    const mila = container.querySelector('[data-slot="member-column"][data-member-id="m1"]')!;
    const titles = [...mila.querySelectorAll('[data-slot="day-agenda-row"]')].map((row) =>
      row.getAttribute('data-event-id')!
    );
    expect(titles).toEqual(['vrij', 'nacht']);
  });
});
