import { NextIntlClientProvider } from 'next-intl';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import { CombinedDayList } from '@/modules/calendar/ui/combined-day-list';
import { PersonColumns } from '@/modules/calendar/ui/person-columns';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';
import messages from '../../../messages/nl.json';

/**
 * §7 `calendar:view_private` → `busy-only`, on the day board's row.
 *
 * `DayAgendaRow` redacts the *title* (`titleOf` → "Bezet") and then printed the
 * owner's name underneath it as the "whose is this" sub-label — or, failing a
 * name, "Iedereen". Both of its feeders handed it owner-derived names for a
 * redacted row: `person-columns.tsx`'s `withFor` (which starts the list with
 * the column's own member) and `combined-day-list.tsx` (which resolves
 * `combineDayEvents`' member ids to display names).
 *
 * The assertions are scoped to the row, not the board: a member column is
 * captioned with that member's face and name and the shared block is captioned
 * "Iedereen", and both of those are legitimate — the tablet knows who lives
 * here. What it may not learn is which of them a hidden hour belongs to.
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
    // What `queries.ts` leaves on a redacted row: no title at all.
    title: '',
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
    busyOnly: true,
    editable: false,
    householdWide: false,
    ...overrides,
  } as CalendarEvent;
}

const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

// Initials are `displayName.trim().slice(0, 2).toUpperCase()` (`MemberFace`).
const identifying = ['Mila', 'Daan', 'MI', 'DA', 'Iedereen'];

function withIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="nl" timeZone={TZ} messages={{ calendar: messages.calendar }}>
      <FormattingLocaleProvider formattingLocale="nl-NL">{node}</FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

function rowsOf(container: HTMLElement): HTMLElement[] {
  const rows = [...container.querySelectorAll<HTMLElement>('[data-slot="day-agenda-row"]')];
  expect(rows.length).toBeGreaterThan(0);
  return rows;
}

function expectAnonymous(rows: HTMLElement[]) {
  for (const row of rows) {
    const html = row.outerHTML;
    for (const fragment of identifying) {
      expect(html).not.toContain(fragment);
    }
    expect(row.querySelector('[data-slot="avatar"]')).toBeNull();
    expect(row.querySelector('[data-slot="member-faces"]')).toBeNull();
    expect(html).toContain('Bezet');
  }
}

describe('PersonColumns — a busy-only row never names anyone', () => {
  const renderBoard = (events: CalendarEvent[]) =>
    withIntl(
      <PersonColumns members={members} events={events} timeZone={TZ} day={DAY} now={null} />
    );

  it('names nobody under a redacted row in its owner’s own column', () => {
    const { container } = renderBoard([event({ ownerMemberId: 'm1' })]);
    expectAnonymous(rowsOf(container));
  });

  it('names nobody under a redacted row shared with a second member', () => {
    const { container } = renderBoard([event({ ownerMemberId: 'm1', attendeeMemberIds: ['m2'] })]);
    expectAnonymous(rowsOf(container));
  });

  it('does not fall back to "Iedereen" for a redacted household row', () => {
    const { container } = renderBoard([event({ householdWide: true, ownerMemberId: 'm1' })]);
    expectAnonymous(rowsOf(container));
  });

  it('still names the people sharing a row that is not redacted', () => {
    const { container } = renderBoard([
      event({ busyOnly: false, title: 'Tandarts', ownerMemberId: 'm1', attendeeMemberIds: ['m2'] }),
    ]);

    expect(rowsOf(container)[0].outerHTML).toContain('Daan');
  });
});

describe('CombinedDayList — a busy-only row never names anyone', () => {
  const renderList = (events: CalendarEvent[]) =>
    withIntl(
      <CombinedDayList members={members} events={events} timeZone={TZ} day={DAY} now={null} />
    );

  it('names nobody under a redacted row', () => {
    const { container } = renderList([event({ ownerMemberId: 'm1' })]);
    expectAnonymous(rowsOf(container));
  });

  it('names nobody under a redacted row that names several people', () => {
    const { container } = renderList([event({ ownerMemberId: 'm1', attendeeMemberIds: ['m2'] })]);
    expectAnonymous(rowsOf(container));
  });

  it('does not fall back to "Iedereen" for a redacted household row', () => {
    const { container } = renderList([event({ householdWide: true, ownerMemberId: 'm1' })]);
    expectAnonymous(rowsOf(container));
  });

  it('still names the people on a row that is not redacted', () => {
    const { container } = renderList([
      event({ busyOnly: false, title: 'Tandarts', ownerMemberId: 'm1' }),
    ]);

    expect(rowsOf(container)[0].outerHTML).toContain('Mila');
  });
});
