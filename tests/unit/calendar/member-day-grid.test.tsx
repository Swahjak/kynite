import { NextIntlClientProvider } from 'next-intl';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';
import type { CalendarEvent } from '@/modules/calendar/queries';
import messages from '../../../messages/en.json';

// The grid's drag hook imports the calendar server actions, which pull
// `server-only` and the Postgres client. The gesture is not what this test is
// about — the partition into columns is — so the module is stubbed at the
// boundary rather than the database being stood up for a render test.
vi.mock('@/modules/calendar/actions', () => ({
  rescheduleEventAction: vi.fn(),
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));

// `@/i18n/navigation` builds next-intl's client navigation off `next/navigation`,
// which does not resolve outside the Next runtime. The grid only needs
// `useRouter().refresh()` after a drag lands, so the module is stubbed.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const { MemberDayGrid } = await import('@/modules/calendar/ui/member-day-grid');

const TZ = 'Europe/Amsterdam';

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
    startsAt: new Date('2026-03-11T09:00:00.000Z'),
    endsAt: new Date('2026-03-11T10:00:00.000Z'),
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

function renderGrid(
  members: Member[],
  events: CalendarEvent[],
  onSelect?: (event: CalendarEvent) => void
) {
  return render(
    <NextIntlClientProvider locale="en" timeZone={TZ} messages={{ calendar: messages.calendar }}>
      <MemberDayGrid
        members={members}
        events={events}
        timeZone={TZ}
        day={new Date('2026-03-11T12:00:00.000Z')}
        now={null}
        onSelect={onSelect}
      />
    </NextIntlClientProvider>
  );
}

/**
 * M19: day view is one column per member. The rule worth pinning is the one
 * `PersonColumns` established and this grid inherits — an event nobody in the
 * family owns is *not* copied into every column, because four copies of one
 * family dinner reads as four commitments. It becomes the shared band.
 */
describe('MemberDayGrid', () => {
  const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

  it('renders one column per member, in order', () => {
    const { container } = renderGrid(members, []);

    const columns = container.querySelectorAll('[data-slot="member-column"]');
    expect(columns).toHaveLength(2);
    expect(columns[0].textContent).toContain('Mila');
    expect(columns[1].textContent).toContain('Daan');
  });

  it('puts an owned event in its owner’s column only', () => {
    const { container } = renderGrid(members, [event({ ownerMemberId: 'm1' })]);

    const columns = container.querySelectorAll('[data-slot="member-column"]');
    expect(columns[0].querySelectorAll('[data-slot="event-chip"]')).toHaveLength(1);
    expect(columns[1].querySelectorAll('[data-slot="event-chip"]')).toHaveLength(0);
  });

  it('puts an unowned event in the household lane rather than in every column', () => {
    const { container } = renderGrid(members, [event({ title: 'Familiediner' })]);

    const lane = container.querySelector('[data-slot="shared-column"]');
    expect(lane?.querySelectorAll('[data-slot="event-chip"]')).toHaveLength(1);
    for (const column of container.querySelectorAll('[data-slot="member-column"]')) {
      expect(column.querySelectorAll('[data-slot="event-chip"]')).toHaveLength(0);
    }
  });

  /**
   * F15. An event *is* attributed, but to somebody this grid does not render —
   * a soft-deleted member, or one filtered off the board. Promoting it into the
   * household lane put one person's appointment in front of the whole family.
   */
  it('drops an event attributed to a member it does not render, rather than sharing it', () => {
    const { container } = renderGrid(members, [
      event({ title: 'Sollicitatiegesprek', ownerMemberId: 'deleted-member' }),
    ]);

    expect(container.querySelector('[data-slot="shared-column"]')).toBeNull();
    expect(screen.queryByText('Sollicitatiegesprek')).toBeNull();
  });

  it('drops an event whose only attendee is not rendered', () => {
    const { container } = renderGrid(members, [
      event({ title: 'Oudergesprek', attendeeMemberIds: ['deleted-member'] }),
    ]);

    expect(screen.queryByText('Oudergesprek')).toBeNull();
    expect(container.querySelectorAll('[data-slot="event-chip"]')).toHaveLength(0);
  });

  /**
   * F16. The household events used to be an absolutely-positioned band drawn
   * across every column, so a shared block at 10:00 sat on top of — and
   * swallowed the clicks of — every member's block at 10:00. A lane of its own
   * cannot overlap anything.
   */
  it('leaves a member event clickable when a household event shares the hour', () => {
    const onSelect = vi.fn();
    const { container } = renderGrid(
      members,
      [
        event({ key: 'mine', seriesId: 'mine', title: 'Tandarts', ownerMemberId: 'm1' }),
        event({ key: 'ours', seriesId: 'ours', title: 'Familiediner' }),
      ],
      onSelect
    );

    const lane = container.querySelector('[data-slot="shared-column"]')!;
    const column = container.querySelector('[data-slot="member-column"][data-member-id="m1"]')!;

    // Two lanes, side by side — neither contains the other, so neither can
    // cover the other.
    expect(lane.contains(column)).toBe(false);
    expect(column.contains(lane)).toBe(false);
    expect(container.querySelector('[data-slot="shared-band-layer"]')).toBeNull();

    const chip = column.querySelector('[data-slot="event-chip"]')!;
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].key).toBe('mine');

    fireEvent.click(lane.querySelector('[data-slot="event-chip"]')!);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[1][0].key).toBe('ours');
  });

  /**
   * F18. The all-day branch used to run *before* attribution and threw the
   * owner away, so one child's holiday landed in a strip that reads as the
   * whole household's.
   */
  it('marks an all-day event with the member it belongs to', () => {
    const { container } = renderGrid(members, [
      event({ title: 'Vakantie', allDay: true, ownerMemberId: 'm1' }),
    ]);

    const allDayRow = container.querySelector('[data-slot="all-day-row"]');
    expect(allDayRow).not.toBeNull();
    expect(allDayRow!.textContent).toContain('Vakantie');
    expect(screen.getAllByText('Vakantie')).toHaveLength(1);

    const group = allDayRow!.querySelector('[data-slot="all-day-member"]');
    expect(group?.getAttribute('data-member-id')).toBe('m1');
    expect(group!.textContent).toContain('Mila');
    expect(group!.querySelectorAll('[data-slot="event-chip"]')).toHaveLength(1);
  });

  it('leaves an unattributed all-day event unmarked, in the household strip', () => {
    const { container } = renderGrid(members, [event({ title: 'Schoolvakantie', allDay: true })]);

    const allDayRow = container.querySelector('[data-slot="all-day-row"]')!;
    expect(allDayRow.querySelector('[data-slot="all-day-member"]')).toBeNull();
    expect(allDayRow.textContent).toContain('Schoolvakantie');
  });

  /**
   * F19. `pointerup` after a real drag is followed by a synthetic `click`. That
   * click used to open the editor seeded with the block's *pre-drag* times, so
   * pressing save silently undid the reschedule the drag had just written.
   */
  it('swallows the synthetic click that follows a drag, but not the next real one', () => {
    const onSelect = vi.fn();
    const { container } = renderGrid(members, [event({ ownerMemberId: 'm1' })], onSelect);

    const chip = container.querySelector('[data-slot="event-chip"]')!;

    fireEvent.pointerDown(chip, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 10, clientY: 66 });
    fireEvent.pointerUp(window);
    fireEvent.click(chip);

    expect(onSelect).not.toHaveBeenCalled();

    // The guard is consumed, not sticky: tapping the block still opens it.
    fireEvent.click(chip);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('leaves a click that never moved alone', () => {
    const onSelect = vi.fn();
    const { container } = renderGrid(members, [event({ ownerMemberId: 'm1' })], onSelect);

    const chip = container.querySelector('[data-slot="event-chip"]')!;

    fireEvent.pointerDown(chip, { button: 0, clientX: 10, clientY: 10 });
    // Under the 4px threshold — a tap with a shaky finger, not a drag.
    fireEvent.pointerMove(window, { clientX: 11, clientY: 12 });
    fireEvent.pointerUp(window);
    fireEvent.click(chip);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  /** F21. An all-day commitment is still a commitment — the day is not free. */
  it('does not call a day free when the member has only an all-day event', () => {
    const { container } = renderGrid(members, [
      event({ title: 'Vakantie', allDay: true, ownerMemberId: 'm1' }),
    ]);

    const mila = container.querySelector('[data-slot="member-column"][data-member-id="m1"]')!;
    const daan = container.querySelector('[data-slot="member-column"][data-member-id="m2"]')!;

    expect(mila.querySelector('[data-slot="member-day-empty"]')).toBeNull();
    expect(daan.querySelector('[data-slot="member-day-empty"]')).not.toBeNull();
  });
});
