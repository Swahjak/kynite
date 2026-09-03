import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * The phone's day, on a day that means something.
 *
 * `TodayTabDag` can draw a banner all it likes; if `(app)/today` never resolves
 * a theme, the phone is still quiet on Kerst and in the zomervakantie. That was
 * exactly the failure — the banner existed, the domain function existed, and
 * only the hub page ever called it — so this test goes through the real page
 * and the real `resolveTodayTheme` rather than through a prop.
 *
 * 17 August 2026 is inside the Dutch zomervakantie (11 July – 23 August, see
 * `holidays/domain/school-holidays.ts`), so it is a date the household would
 * actually be looking at.
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
  toDateKey: (date: Date) => date.toISOString().slice(0, 10),
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

vi.mock('@/modules/weather', () => ({
  WeatherWidget: () => <div data-testid="weather-card" />,
  getFamilyWeather: async () => null,
}));

// Everything the page composes is a marker — except `resolveTodayTheme`, which
// is the whole point of the test and stays real.
vi.mock('@/modules/today', async () => {
  const { resolveTodayTheme } = await vi.importActual<
    typeof import('@/modules/today/domain/theme')
  >('@/modules/today/domain/theme');

  return {
    resolveTodayTheme,
    flowOf: () => ({ mode: 'next', hero: null, live: false, liveBlocks: [] }),
    loadTodayProgress: async () => null,
    TodayHeader: () => <div data-testid="today-header" />,
    TodayLive: () => null,
    TodayNowStrip: () => <div data-testid="today-now" />,
    TodayThemeBanner: ({ theme }: { theme: { key: string } }) => (
      <div data-testid="today-theme-banner" data-slug={theme.key} />
    ),
    TodayFab: () => null,
    TodayTabDag: ({ banner }: { banner?: ReactNode }) => (
      <div data-testid="today-dag">{banner}</div>
    ),
    TodayTabPersonen: () => null,
    TodayTabRoutines: () => null,
    TodayTabSterren: () => null,
    TodayTabs: ({ dag }: { dag: ReactNode }) => <div data-testid="today-tabs">{dag}</div>,
  };
});

const TodayPage = (await import('@/app/[locale]/(app)/today/page')).default;

/** Inside the zomervakantie. */
const IN_SUMMER_BREAK = new Date('2026-08-17T09:00:00.000Z');
/** A week after it ends — an ordinary Monday. */
const ORDINARY = new Date('2026-08-31T09:00:00.000Z');

async function renderPage(now: Date) {
  loadCalendarPage.mockResolvedValue({
    now,
    anchor: now,
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

describe('(app)/today — the day’s theme', () => {
  it('banners the zomervakantie on the phone', async () => {
    const { container } = await renderPage(IN_SUMMER_BREAK);

    const banner = container.querySelector('[data-testid="today-theme-banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.getAttribute('data-slug')).toBe('summerBreak');
  });

  it('hands the banner to the day panel, not to a second block', async () => {
    const { container } = await renderPage(IN_SUMMER_BREAK);

    expect(
      container.querySelector('[data-testid="today-dag"] [data-testid="today-theme-banner"]')
    ).not.toBeNull();
  });

  it('stands the NU strip down on a themed day', async () => {
    const { container } = await renderPage(IN_SUMMER_BREAK);

    expect(container.querySelector('[data-testid="today-now"]')).toBeNull();
  });

  it('keeps the NU strip and draws no banner on an ordinary day', async () => {
    const { container } = await renderPage(ORDINARY);

    expect(container.querySelector('[data-testid="today-now"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="today-theme-banner"]')).toBeNull();
  });
});
