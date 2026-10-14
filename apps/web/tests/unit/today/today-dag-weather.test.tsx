import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';

/**
 * The day panel's two placed bands, drawn on both surfaces: the weather card
 * and the NU block (`today-tab-dag.tsx`, "The two bands the panel places on
 * both surfaces").
 *
 * Both used to be bands of the phone page itself (`(app)/today`): the weather
 * card at the top and the NU strip under it. H3 merged the phone and wall
 * routes into one page (`(main)/today`), so the page no longer draws either
 * band — it hands the resolved weather card and the banner to `TodayTabDag`,
 * and the panel places them. The page-level tests
 * (`today-page-composition.test.tsx`, `today-page-theme.test.tsx`) now cover
 * only what the page still decides; this file pins the placement that lives
 * here:
 *
 *  1. the weather card is drawn on both surfaces — dropping the panel's
 *     `weather` slot would silence the weather everywhere;
 *  2. on the wall the NU block owns the first column and the weather the
 *     second, so the two never collapse into one column;
 *  3. an ordinary day draws the NU block and no banner, on both surfaces —
 *     dropping the phone's strip (H3's regression) must fail here.
 */

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/modules/family', async () => {
  const { MEMBER_COLOR_CLASSES } = await vi.importActual<
    typeof import('@/modules/family/ui/tokens')
  >('@/modules/family/ui/tokens');

  return { MEMBER_COLOR_CLASSES };
});

// The pieces the panel arranges all have tests of their own. What matters here
// is which of them the panel mounts, on which surface, and in which column.
vi.mock('@/modules/tasks', () => ({
  TaskList: () => <div data-testid="task-list" />,
}));

vi.mock('@/modules/today/ui/today-timeline', () => ({
  TodayTimeline: () => <div data-testid="today-timeline" />,
}));

vi.mock('@/modules/today/ui/today-now-strip', () => ({
  TodayNowStrip: () => <div data-testid="today-now" />,
}));

vi.mock('@/modules/today/ui/today-tab-routines', () => ({
  TodayTabRoutines: () => <div data-testid="today-routines" />,
}));

const { TodayTabDag } = await import('@/modules/today/ui/today-tab-dag');

const TZ = 'Europe/Amsterdam';
const NOW = new Date('2026-08-17T09:00:00.000Z');

function member(): Member {
  return {
    id: 'm1',
    familyId: 'family-1',
    displayName: 'Sanne',
    role: 'parent',
    color: 'blue',
    avatarUrl: null,
    sortOrder: 0,
    birthday: null,
    starBalance: 0,
  } as unknown as Member;
}

const tasks = {
  tasks: [],
  members: [{ id: 'm1', displayName: 'Sanne' }],
  canWrite: true,
  canComplete: true,
} as unknown as Parameters<typeof TodayTabDag>[0]['tasks'];

async function renderDag({
  surface,
  banner = null,
  weather = null,
}: {
  surface: 'app' | 'hub';
  banner?: ReactNode;
  weather?: ReactNode;
}) {
  return render(
    await TodayTabDag({
      surface,
      members: [member()],
      events: [],
      timeZone: TZ,
      dayKey: '2026-08-17',
      now: NOW,
      isToday: true,
      nowEventKeys: [],
      tasks,
      banner,
      heroEvents: [],
      flowMode: 'next',
      referenceNow: NOW,
      kids: [],
      weather,
    })
  );
}

const WEATHER = <div data-testid="weather-card" />;

describe('TodayTabDag — the weather card and the NU block', () => {
  it.each(['app', 'hub'] as const)('draws the weather card on %s', async (surface) => {
    const { container } = await renderDag({ surface, weather: WEATHER });

    expect(container.querySelector('[data-testid="weather-card"]')).not.toBeNull();
  });

  it('draws the weather card before the NU strip on the phone', async () => {
    const { container } = await renderDag({ surface: 'app', weather: WEATHER });

    const order = [...container.querySelectorAll('[data-testid]')].map((node) =>
      node.getAttribute('data-testid')
    );

    expect(order).toContain('weather-card');
    expect(order).toContain('today-now');
    expect(order.indexOf('weather-card')).toBeLessThan(order.indexOf('today-now'));
  });

  it('keeps the NU block in the first column and the weather in the second on the wall', async () => {
    const { container } = await renderDag({ surface: 'hub', weather: WEATHER });

    const order = [...container.querySelectorAll('[data-testid]')].map((node) =>
      node.getAttribute('data-testid')
    );

    expect(order).toContain('today-now');
    expect(order).toContain('weather-card');
    expect(order.indexOf('today-now')).toBeLessThan(order.indexOf('weather-card'));
  });

  it.each(['app', 'hub'] as const)(
    'keeps the NU strip on an ordinary day on %s',
    async (surface) => {
      const { container } = await renderDag({ surface });

      expect(container.querySelector('[data-testid="today-now"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="today-theme-banner"]')).toBeNull();
    }
  );
});
