import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The order of the phone `(app)/today` bands.
 *
 * The weather card used to sit *between* the NU strip and the tabs. The design
 * moved it to the top of the phone screen: on a phone the first thing the day
 * answers is "what is it doing outside", because that is what decides the coat
 * before it decides the schedule. The wall's own placement (`TodayTabDag`'s
 * `weather` slot, which only `surface="hub"` fills) is a separate composition
 * and is deliberately untouched.
 *
 * The assertion is on *document order*, not on source order, so it survives a
 * refactor that moves the JSX around as long as what lands in the tree is
 * right. The two today-only rules the card shares with the rest of the page —
 * it is `density="phone"`, and a browsed day gets no card at all — are pinned
 * here too, since moving a block is exactly when a gate gets dropped.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const loadCalendarPage = vi.fn();

vi.mock('@/modules/calendar', () => ({
  AddEventFabAction: () => null,
  dayKeysOf: () => [] as string[],
  isSameDay: (a: Date, b: Date) => a.getTime() === b.getTime(),
  loadCalendarPage: (...args: unknown[]) => loadCalendarPage(...args),
  toDateKey: () => '2026-08-15',
  toWall: (date: Date) => date,
}));

vi.mock('@/modules/family', () => ({
  firstNameOf: () => '',
  getMember: async () => null,
  getPrincipal: async () => null,
  greetingSlotFor: () => 'morning',
  hourIn: () => 9,
}));

vi.mock('@/modules/tasks', () => ({
  loadTodayTasks: async () => null,
}));

vi.mock('@/modules/today', () => ({
  // An ordinary day, so the NU strip is drawn and the band order below is the
  // one this file is about. The themed day is `today-page-theme.test.tsx`.
  resolveTodayTheme: () => null,
  TodayThemeBanner: () => <div data-testid="today-theme-banner" />,
  TodayHeader: () => <div data-testid="today-header" />,
  TodayLive: () => null,
  TodayNowStrip: () => <div data-testid="today-now" />,
  TodayFab: () => null,
  TodayTabDag: () => null,
  TodayTabPersonen: () => null,
  TodayTabRoutines: () => null,
  TodayTabSterren: () => null,
  TodayTabs: () => <div data-testid="today-tabs" />,
  flowOf: () => ({ mode: 'next', hero: null, live: false }),
  loadTodayProgress: async () => null,
}));

const weatherProps = vi.fn();

vi.mock('@/modules/weather', () => ({
  WeatherWidget: (props: { density?: string }) => {
    weatherProps(props);
    return <div data-testid="weather-card" />;
  },
  getFamilyWeather: async () => ({ status: 'ok' }),
}));

const TodayPage = (await import('@/app/[locale]/(app)/today/page')).default;

const NOW = new Date('2026-08-15T09:00:00.000Z');

async function renderPage({ anchor }: { anchor: Date }) {
  loadCalendarPage.mockResolvedValue({
    now: NOW,
    anchor,
    timeZone: 'Europe/Amsterdam',
    events: [],
    members: [],
    calendars: [],
    canWrite: true,
    familyId: 'family-1',
  });

  return render(
    await TodayPage({
      params: Promise.resolve({ locale: 'nl' }),
      searchParams: Promise.resolve({}),
    })
  );
}

describe('(app)/today — band order on the phone', () => {
  it('draws the weather card before the NU strip', async () => {
    const { container } = await renderPage({ anchor: NOW });

    const order = [...container.querySelectorAll('[data-testid]')].map((node) =>
      node.getAttribute('data-testid')
    );

    expect(order).toContain('weather-card');
    expect(order.indexOf('weather-card')).toBeLessThan(order.indexOf('today-now'));
    // …and it is still a band of the page, not a thing above the header.
    expect(order.indexOf('today-header')).toBeLessThan(order.indexOf('weather-card'));
  });

  it('draws the phone density', async () => {
    await renderPage({ anchor: NOW });

    expect(weatherProps).toHaveBeenCalledWith(expect.objectContaining({ density: 'phone' }));
  });

  it('draws no weather card on a browsed day', async () => {
    const { container } = await renderPage({ anchor: new Date('2026-08-14T00:00:00.000Z') });

    expect(container.querySelector('[data-testid="weather-card"]')).toBeNull();
    expect(container.querySelector('[data-testid="today-now"]')).not.toBeNull();
  });
});
