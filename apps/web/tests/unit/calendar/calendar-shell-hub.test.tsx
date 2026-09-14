import { NextIntlClientProvider } from 'next-intl';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormattingLocaleProvider } from '@/components/formatting';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';
import messages from '../../../messages/en.json';

/**
 * `CalendarShell`'s drag hook and `EventDialog` both call into
 * `../actions`, which pulls `server-only` and the Postgres client — stubbed
 * at the boundary the same way `member-day-grid.test.tsx` does, since this
 * suite is about the hub's presentation of the shell, not the write path.
 */
vi.mock('@/modules/calendar/actions', () => ({
  rescheduleEventAction: vi.fn(),
  createEventAction: vi.fn(),
  updateEventAction: vi.fn(),
  deleteEventAction: vi.fn(),
}));

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push, replace, refresh }),
}));

const { CalendarShell } = await import('@/modules/calendar/ui/calendar-shell');

const TZ = 'Europe/Amsterdam';

/** `useIsWide` defaults to wide until told otherwise — the wall tablet's case. */
function stubWide() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: true,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  replace.mockClear();
  refresh.mockClear();
});

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
    householdWide: false,
    ...overrides,
  } as CalendarEvent;
}

const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

function renderShell(overrides: Partial<React.ComponentProps<typeof CalendarShell>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" timeZone={TZ} messages={{ calendar: messages.calendar }}>
      <FormattingLocaleProvider formattingLocale="en-GB">
        <CalendarShell
          view="day"
          anchor={new Date('2026-03-11T12:00:00.000Z')}
          events={[event()]}
          members={members}
          calendars={[]}
          timeZone={TZ}
          weekStartsOn={1}
          now={new Date('2026-03-11T10:00:00.000Z')}
          canWrite={false}
          {...overrides}
        />
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}

/**
 * `surface="hub"` — the plan's decision that the hub renders the app's own
 * `CalendarShell` with lesser permissions, not a second UI
 * (`docs/plans/2026-09-14-hub-calendar-shell.md`). The route's own
 * `TodayHeader surface="hub"` already carries the date, the chevrons, the
 * faces and the clock, so the shell contributes only the member filter and
 * the board underneath.
 */
describe('CalendarShell surface="hub"', () => {
  it('renders no shell header and no view switcher, but keeps the member filter', () => {
    stubWide();
    renderShell({ surface: 'hub', canWrite: false });

    expect(screen.queryByTestId('calendar-heading')).toBeNull();
    expect(screen.queryByTestId('view-switcher')).toBeNull();

    const filter = screen.getByRole('group', { name: 'Filter by family member' });
    expect(filter.querySelectorAll('[data-slot="member-filter-face"]')).toHaveLength(
      members.length
    );
  });

  it('renders no create action and no event dialog — a device principal cannot write', () => {
    stubWide();
    renderShell({ surface: 'hub', canWrite: false });

    expect(screen.queryByTestId('event-create')).toBeNull();
    expect(screen.queryByTestId('event-dialog')).toBeNull();
  });

  it('still renders the day board — one column per member', () => {
    stubWide();
    const { container } = renderShell({ surface: 'hub', canWrite: false, view: 'day' });

    expect(screen.getByTestId('calendar-view-day')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="member-column"]')).toHaveLength(members.length);
  });
});

/**
 * `basePath` (default `/calendar`) is what lets one shell serve two routes —
 * `/calendar` for the app and `/hub/kalender` for the hub. The three pushes
 * it replaces are exercised here directly against a non-default `basePath`,
 * independent of which surface happens to render the control that triggers
 * them.
 */
describe('CalendarShell basePath', () => {
  it('navigates the arrows and "Vandaag" against basePath, not /calendar', () => {
    stubWide();
    renderShell({ surface: 'app', canWrite: false, basePath: '/hub/kalender' });

    screen.getByLabelText('Previous period').click();
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/hub\/kalender\?/));

    push.mockClear();
    screen.getByLabelText('Next period').click();
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/hub\/kalender\?/));

    push.mockClear();
    screen.getByText('Today').click();
    expect(push).toHaveBeenCalledWith('/hub/kalender?view=day');
  });
});
