import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What the phone `(main)/today` page still decides about the weather card.
 *
 * The weather card used to be a band of the phone page itself — above the NU
 * strip, below the header, at `density="phone"`. H3 merged the phone and wall
 * routes into one page, so the bands moved into `TodayTabDag`: the panel now
 * places the weather slot and the NU block (`today-dag-weather.test.tsx` pins
 * that placement), and the page hands the resolved weather card to it as a
 * prop rather than drawing a band of its own.
 *
 * What remains the page's to decide is pinned here:
 *
 *  1. it forwards the resolved weather card into the panel on today;
 *  2. it forwards nothing on a browsed day — weather is *now*, not a property
 *     of the day being looked at;
 *  3. it derives the density from the surface — `density="phone"` on `app`,
 *     `density="hub"` on `hub`. The page now forwards the density it resolves;
 *     it did not in H3a (it rendered `<WeatherWidget view={weather} />` with no
 *     density, so every surface fell back to the wall's `hub` density). These
 *     two assertions stay so a drop of the prop goes red again.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const loadCalendarPage = vi.fn();
const loadHubBoardComposition = vi.fn();

vi.mock('@/modules/calendar', () => ({
  AddEventFabAction: () => null,
  dayKeysOf: () => [] as string[],
  isSameDay: (a: Date, b: Date) => a.getTime() === b.getTime(),
  loadCalendarPage: (...args: unknown[]) => loadCalendarPage(...args),
  toDateKey: () => '2026-08-15',
  toWall: (date: Date) => date,
  HubBoard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/modules/devices', () => ({
  requireMemberOrDevice: async () => undefined,
}));

const getSurface = vi.fn();

vi.mock('@/modules/surface', () => ({
  getSurface: (...args: unknown[]) => getSurface(...args),
  presentationFor: (surface: string) => (surface === 'app' ? 'app' : 'hub'),
}));

vi.mock('@/modules/timers', () => ({
  AmbientTimers: () => null,
  TimerStartFabAction: () => null,
  loadTimerBoard: async () => null,
}));

vi.mock('@/components/hub', () => ({
  ChildLauncher: () => null,
}));

vi.mock('@kynite/ui', () => ({
  EmptyState: () => null,
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
  // An ordinary day, so no banner is forwarded; the themed day is
  // `today-page-theme.test.tsx`.
  resolveTodayTheme: () => null,
  TodayThemeBanner: () => <div data-testid="today-theme-banner" />,
  TodayHeader: () => <div data-testid="today-header" />,
  TodayLive: () => null,
  TodayNowStrip: () => <div data-testid="today-now" />,
  TodayFab: () => null,
  TodayFilterProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TodayTabDag: ({
    weather,
    banner,
    launcher,
  }: {
    weather?: ReactNode;
    banner?: ReactNode;
    launcher?: ReactNode;
  }) => (
    <div data-testid="today-dag">
      {banner}
      {weather}
      {launcher}
    </div>
  ),
  TodayTabRoutines: () => null,
  TodayTabSterren: () => null,
  flowOf: () => ({ mode: 'next', hero: null, live: false, liveBlocks: [] }),
  loadTodayProgress: async () => null,
  loadHubBoardComposition: (...args: unknown[]) => loadHubBoardComposition(...args),
}));

const weatherProps = vi.fn();

vi.mock('@/modules/weather', () => ({
  WeatherWidget: (props: { density?: string }) => {
    weatherProps(props);
    return <div data-testid="weather-card" />;
  },
  getFamilyWeather: async () => ({ status: 'ok' }),
}));

const TodayPage = (await import('@/app/[locale]/(main)/today/page')).default;

const NOW = new Date('2026-08-15T09:00:00.000Z');

async function renderPage({ anchor }: { anchor: Date }) {
  const isToday = anchor.getTime() === NOW.getTime();

  loadHubBoardComposition.mockResolvedValue({
    data: {
      familyId: 'family-1',
      now: NOW,
      anchor,
      timeZone: 'Europe/Amsterdam',
      events: [],
      members: [],
      view: 'day',
      weekStartsOn: 1,
    },
    dayKey: '2026-08-15',
    dayEvents: [],
    isToday,
    reference: { kind: 'today', now: NOW },
    flow: { mode: 'next', hero: null, live: false, liveBlocks: [] },
    theme: null,
    progress: null,
    tasks: null,
    weather: isToday ? { status: 'ok' as const } : null,
    children: [],
    slot: 'morning',
  });

  return render(
    await TodayPage({
      params: Promise.resolve({ locale: 'nl' }),
      searchParams: Promise.resolve({}),
    })
  );
}

describe('(main)/today — the weather card is the page’s to forward', () => {
  beforeEach(() => {
    getSurface.mockReset();
    getSurface.mockResolvedValue('app');
    weatherProps.mockClear();
  });

  it('forwards the weather card into the day panel on today', async () => {
    const { container } = await renderPage({ anchor: NOW });

    expect(container.querySelector('[data-testid="weather-card"]')).not.toBeNull();
  });

  it('draws the phone density', async () => {
    await renderPage({ anchor: NOW });

    expect(weatherProps).toHaveBeenCalledWith(expect.objectContaining({ density: 'phone' }));
  });

  it('draws the hub density', async () => {
    getSurface.mockResolvedValue('hub');

    await renderPage({ anchor: NOW });

    expect(weatherProps).toHaveBeenCalledWith(expect.objectContaining({ density: 'hub' }));
  });

  it('draws no weather card on a browsed day', async () => {
    const { container } = await renderPage({ anchor: new Date('2026-08-14T00:00:00.000Z') });

    expect(container.querySelector('[data-testid="weather-card"]')).toBeNull();
  });
});
