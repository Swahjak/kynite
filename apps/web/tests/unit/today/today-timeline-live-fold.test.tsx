import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEvent } from '@/modules/calendar/queries';
import type { Member } from '@/modules/family';

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
        track: 'bg-test-track',
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
// 10:00 local; the event runs 09:30-10:30 local, so it is live.
const NOW = new Date('2026-03-10T09:00:00.000Z');

const members = [
  {
    id: 'm1',
    familyId: 'family-1',
    displayName: 'Mila',
    role: 'child',
    color: 'blue',
    avatarUrl: null,
    sortOrder: 0,
    birthday: null,
    starBalance: 0,
  } as unknown as Member,
];

const live = {
  key: 'live1',
  seriesId: 'live1',
  title: 'Tandarts',
  description: null,
  location: null,
  startsAt: new Date('2026-03-10T08:30:00.000Z'),
  endsAt: new Date('2026-03-10T09:30:00.000Z'),
  allDay: false,
  tz: TZ,
  ownerMemberId: 'm1',
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
} as unknown as CalendarEvent;

async function renderLive(foldLive: boolean | undefined, density: 'list' | 'card' = 'card') {
  const { container } = render(
    await TodayTimeline({
      members,
      events: [live],
      timeZone: TZ,
      dayKey: DAY_KEY,
      now: NOW,
      isToday: true,
      nowEventKeys: ['live1'],
      foldLive,
      density,
    })
  );

  return container;
}

describe('TodayTimeline — live rows and the NU strip', () => {
  it('folds a live row behind the toggle by default (the NU strip carries it)', async () => {
    const container = await renderLive(undefined);

    expect(container.querySelector('[data-testid="today-past-toggle"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="today-timeline-row"]')).toBeNull();
  });

  it('folds it with foldLive true', async () => {
    const container = await renderLive(true);

    expect(container.querySelector('[data-testid="today-past-toggle"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="today-timeline-row"]')).toBeNull();
  });

  it.each(['card', 'list'] as const)(
    'keeps it open and tinted now with foldLive false, and offers no toggle (%s)',
    async (density) => {
      const container = await renderLive(false, density);

      const row = container.querySelector('[data-testid="today-timeline-row"]');
      expect(row).not.toBeNull();
      expect(row!.getAttribute('data-state')).toBe('now');
      expect(row!.textContent).toContain('Tandarts');
      expect(container.querySelector('[data-testid="today-past-toggle"]')).toBeNull();
    }
  );
});
