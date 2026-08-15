import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';

/**
 * "Per persoon" splits a day the same way the calendar's boards do — through
 * `splitByMember` (`calendar/domain/day-board.ts`) rather than a loop of its
 * own. The rule worth a test here is the one this tab did *not* follow before:
 * an event attributed only to members it does not render is dropped, not
 * promoted into the "Iedereen" column. That column spans the whole family, so
 * promoting a soft-deleted (or unticked) member's appointment publishes their
 * schedule to everyone in front of the wall display.
 *
 * It is an async server component, so it is awaited and its element rendered.
 * The two things it reaches for outside itself are stubbed at the boundary:
 * `next-intl/server` needs a request scope that does not exist in a unit test,
 * and `@/modules/family` is `server-only` (it re-exports its query module).
 */

// The `dom` project deliberately does not alias `server-only` away — a client
// component reaching for it must fail. This one is a *server* component, and
// the calendar barrel it reads `splitByMember` from re-exports `queries.ts`,
// so the guard module is neutralised here rather than globally.
vi.mock('server-only', () => ({}));

// The same barrel reaches the calendar's client components, whose navigation
// helpers are built on `next/navigation` — which does not resolve outside the
// Next runtime. Nothing here navigates.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => children,
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/modules/family', () => ({
  getHouseholdFormattingLocale: async () => 'nl-NL',
  MemberAvatar: ({ displayName }: { displayName: string }) => <span>{displayName}</span>,
}));

const { TodayTabPersonen } = await import('@/modules/today/ui/today-tab-personen');

const TZ = 'Europe/Amsterdam';
const DAY_KEY = '2026-03-10';
const NOW = new Date('2026-03-10T08:00:00.000Z');

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

async function renderTab(members: Member[], events: CalendarEvent[]) {
  return render(
    await TodayTabPersonen({
      members,
      events,
      timeZone: TZ,
      dayKey: DAY_KEY,
      now: NOW,
      isToday: true,
      nowEventKey: null,
    })
  );
}

describe('TodayTabPersonen', () => {
  const members = [member('m1', 'Mila', 0), member('m2', 'Daan', 1)];

  it('puts an owned event in its owner’s column only', async () => {
    const { container } = await renderTab(members, [event({ ownerMemberId: 'm1' })]);

    const mila = container.querySelector('[data-member-id="m1"]')!;
    const daan = container.querySelector('[data-member-id="m2"]')!;
    expect(mila.textContent).toContain('Tandarts');
    expect(daan.textContent).not.toContain('Tandarts');
  });

  it('drops an event attributed only to members it does not render', async () => {
    await renderTab(members, [
      event({ title: 'Sollicitatiegesprek', ownerMemberId: 'left-the-family' }),
    ]);

    expect(screen.queryByText(/Sollicitatiegesprek/)).toBeNull();
  });

  it('keeps an event nobody is attached to in the shared column', async () => {
    await renderTab(members, [event({ title: 'Opa en oma komen' })]);
    expect(screen.getByText(/Opa en oma komen/)).toBeTruthy();
  });

  it('shares a household event even when attribution names one member', async () => {
    const { container } = await renderTab(members, [
      event({ title: 'Familiediner', householdWide: true, ownerMemberId: 'm1' }),
    ]);

    expect(container.querySelector('[data-member-id="m1"]')!.textContent).not.toContain(
      'Familiediner'
    );
    expect(screen.getAllByText(/Familiediner/)).toHaveLength(1);
  });
});
