import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';

/**
 * §7 `calendar:view_private` → `busy-only`. The wall tablet may learn that an
 * hour is occupied; it may never learn whose it is.
 *
 * `queries.ts` blanks the title, the location and `attendeeMemberIds` on a
 * redacted row but deliberately passes `ownerMemberId` through — it is the only
 * routing signal left, and blanking it would dump every private event into the
 * shared lane. So the owner's id *does* reach this component, and everything
 * derived from it here is a leak: `combineDayEvents` resolved it into
 * `memberIds`, the row drew that as a `MemberFaces` stack (avatar, "MI"
 * initials fallback, `aria-label="Mila"`) and named it in the stack's label —
 * all directly beside the word "Bezet".
 *
 * The assertions are on **identity**, not on a component: the rendered row must
 * not contain a member's display name, nor the initials an avatar fallback
 * draws, nor an avatar of any kind — and not "Iedereen" either, because whether
 * a hidden hour is the household's or one person's is itself part of what
 * free/busy withholds.
 *
 * Scoped to the row element rather than the container on purpose: the list's
 * own member *filter* draws the roster's faces, and that is legitimate — the
 * tablet knows who lives here. What it may not know is which of them this hour
 * belongs to.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ children }: { children?: React.ReactNode }) => children,
  redirect: vi.fn(),
  usePathname: () => '/',
}));

vi.mock('next-intl/server', async () => {
  const { createTranslator } = await import('next-intl');
  const messages = (await import('../../../messages/nl.json')).default;

  return {
    getTranslations: async (namespace: string) =>
      createTranslator({ locale: 'nl', messages, namespace }),
  };
});

vi.mock('@/modules/family', () => ({
  getHouseholdFormattingLocale: async () => 'nl-NL',
  MEMBER_COLOR_CLASSES: new Proxy(
    {},
    {
      get: () => ({
        surface: 'bg-test-surface',
        text: 'text-test',
        icon: 'text-test-icon',
        solid: 'bg-test-solid',
      }),
    }
  ),
}));

const { TodayTimeline } = await import('@/modules/today/ui/today-timeline');

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

// Initials are `displayName.trim().slice(0, 2).toUpperCase()` (`MemberFace`),
// so these are the exact strings an avatar fallback would render.
const identifying = ['Mila', 'Daan', 'MI', 'DA', 'Iedereen'];

async function renderTimeline(
  events: CalendarEvent[],
  density: 'list' | 'card' = 'list'
): Promise<HTMLElement> {
  const { container } = render(
    await TodayTimeline({
      members,
      events,
      timeZone: TZ,
      dayKey: DAY_KEY,
      now: NOW,
      isToday: true,
      nowEventKey: null,
      density,
    })
  );

  const row = container.querySelector<HTMLElement>('[data-testid="today-timeline-row"]');
  expect(row).not.toBeNull();
  return row!;
}

function expectAnonymous(row: HTMLElement) {
  const html = row.outerHTML;

  for (const fragment of identifying) {
    expect(html).not.toContain(fragment);
  }
  expect(row.querySelector('[data-slot="avatar"]')).toBeNull();
  expect(row.querySelector('[data-slot="member-faces"]')).toBeNull();
  expect(html).toContain('Bezet');
}

describe('TodayTimeline — a busy-only row never names anyone', () => {
  for (const density of ['list', 'card'] as const) {
    it(`draws no name, initials or face for an owned redacted row (density="${density}")`, async () => {
      expectAnonymous(await renderTimeline([event({ ownerMemberId: 'm1' })], density));
    });
  }

  it('draws no name, initials or face when the redacted row names several people', async () => {
    expectAnonymous(
      await renderTimeline([event({ ownerMemberId: 'm1', attendeeMemberIds: ['m2'] })])
    );
  });

  it('says nothing about a redacted household row either', async () => {
    expectAnonymous(await renderTimeline([event({ householdWide: true, ownerMemberId: 'm1' })]));
  });

  it('still names people on a row that is not redacted', async () => {
    const row = await renderTimeline([
      event({ busyOnly: false, title: 'Tandarts', ownerMemberId: 'm1' }),
    ]);

    expect(row.outerHTML).toContain('Mila');
    expect(row.querySelector('[data-slot="member-faces"]')).not.toBeNull();
  });
});
