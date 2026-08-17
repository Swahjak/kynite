import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';

/**
 * One "Dagoverzicht", two surfaces.
 *
 * The same story as the header (`today-header-surfaces.test.tsx`): `5dc38ee`
 * unified the wall hub and the phone on the principle that "the hub is the app
 * with restricted permissions, not a second product", `0fbacbb` re-forked the
 * top of the page, and the features that landed afterwards each landed on one
 * half. The theme banner (M26) went into the hub's `TodayHubDag` and the phone
 * never got it — so a family looking at their phone in the middle of the
 * zomervakantie saw nothing at all, not because anybody decided that but
 * because there was a second file nobody thought to change.
 *
 * What the tests below pin:
 *
 *  1. the theme banner renders on **both** surfaces (the drift being repaired);
 *  2. the NU block stands down for it on both — the design sheet wraps the NU
 *     card in `<sc-if geenThema>`, and that rule must not be a hub rule;
 *  3. the quick-action grid is a *decided* difference, not an accident, and is
 *     never doubled with the task list's own pills;
 *  4. both routes render the same component, so the fork cannot come back.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));

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
// is which of them the panel mounts, on which surface, and with which of the
// two settings that can be doubled.
vi.mock('@/modules/tasks', () => ({
  TaskList: ({ showQuickActions = true }: { showQuickActions?: boolean }) => (
    <div data-testid="task-list" data-quick-actions={String(showQuickActions)} />
  ),
}));

vi.mock('@/modules/today/ui/today-timeline', () => ({
  TodayTimeline: ({ density }: { density?: string }) => (
    <div data-testid="today-timeline" data-density={density ?? 'list'} />
  ),
}));

vi.mock('@/modules/today/ui/today-now-strip', () => ({
  TodayNowStrip: () => <div data-testid="today-now" />,
}));

vi.mock('@/modules/today/ui/today-quick-actions', () => ({
  TodayQuickActions: () => <div data-testid="today-quick-actions" />,
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
}: {
  surface: 'app' | 'hub';
  banner?: ReactNode;
}) {
  const result = render(
    await TodayTabDag({
      surface,
      members: [member()],
      events: [],
      timeZone: TZ,
      dayKey: '2026-08-17',
      now: NOW,
      isToday: true,
      nowEventKey: null,
      tasks,
      banner,
      heroEvent: null,
      flowMode: 'next',
      referenceNow: NOW,
      kids: [],
      timersHref: surface === 'hub' ? '/hub/timers' : undefined,
      canGiveStars: surface === 'hub',
    })
  );

  // What came back has to actually *be* the surface that was asked for.
  // Without this, a component that ignored the prop would satisfy every
  // assertion below by drawing one surface twice.
  expect(
    result.container.querySelector('[data-surface-variant]')?.getAttribute('data-surface-variant')
  ).toBe(surface);

  return result;
}

const BANNER = <div data-testid="today-theme-banner" />;

describe('TodayTabDag — the theme banner reaches both surfaces', () => {
  it.each(['app', 'hub'] as const)('draws the banner on %s', async (surface) => {
    const { container } = await renderDag({ surface, banner: BANNER });

    expect(container.querySelector('[data-testid="today-theme-banner"]')).not.toBeNull();
  });

  it.each(['app', 'hub'] as const)('stands the NU block down for it on %s', async (surface) => {
    const themed = await renderDag({ surface, banner: BANNER });
    expect(themed.container.querySelector('[data-testid="today-now"]')).toBeNull();
  });

  it('draws the NU block in the hub column on an ordinary day', async () => {
    const { container } = await renderDag({ surface: 'hub' });

    expect(container.querySelector('[data-testid="today-now"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="today-theme-banner"]')).toBeNull();
  });

  it('leaves the phone’s NU strip to the page', async () => {
    // On the phone the strip is a band of `(app)/today` itself, above the tabs
    // (`0dbcd61`'s order: header, weather, NU, tabs). The panel must not draw a
    // second one inside the tab.
    const { container } = await renderDag({ surface: 'app' });

    expect(container.querySelector('[data-testid="today-now"]')).toBeNull();
  });
});

describe('TodayTabDag — what stays surface-shaped', () => {
  it('gives the phone the card timeline and the wall the flat one', async () => {
    const app = await renderDag({ surface: 'app' });
    const hub = await renderDag({ surface: 'hub' });

    expect(
      app.container.querySelector('[data-testid="today-timeline"]')!.getAttribute('data-density')
    ).toBe('card');
    expect(
      hub.container.querySelector('[data-testid="today-timeline"]')!.getAttribute('data-density')
    ).toBe('list');
  });

  it('draws the routines stack on the wall only', async () => {
    const app = await renderDag({ surface: 'app' });
    const hub = await renderDag({ surface: 'hub' });

    expect(app.container.querySelector('[data-testid="today-routines"]')).toBeNull();
    expect(hub.container.querySelector('[data-testid="today-routines"]')).not.toBeNull();
  });
});

describe('TodayTabDag — the quick actions are never doubled', () => {
  it('gives the wall the grid and turns the list’s own pills off', async () => {
    const { container } = await renderDag({ surface: 'hub' });

    expect(container.querySelector('[data-testid="today-quick-actions"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="task-list"]')!.getAttribute('data-quick-actions')
    ).toBe('false');
  });

  it('gives the phone the list’s own pills and no grid', async () => {
    // The four tiles all have a home on the phone already — the FAB, the list's
    // quick-add, the sterren pill — so the grid would be a third copy.
    const { container } = await renderDag({ surface: 'app' });

    expect(container.querySelector('[data-testid="today-quick-actions"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="task-list"]')!.getAttribute('data-quick-actions')
    ).toBe('true');
  });
});

describe('the two routes render the same day panel', () => {
  // Vitest runs with `apps/web` as its working directory.
  const read = (relative: string) => readFileSync(resolve('src', relative), 'utf8');

  const hubPage = read('app/[locale]/(hub)/hub/page.tsx');
  const todayPage = read('app/[locale]/(app)/today/page.tsx');

  it('renders <TodayTabDag> on both surfaces', () => {
    expect(hubPage).toContain('<TodayTabDag');
    expect(todayPage).toContain('<TodayTabDag');
  });

  it('has no second day panel to drift against', () => {
    expect(hubPage).not.toContain('TodayHubDag');
    expect(todayPage).not.toContain('TodayHubDag');
    expect(read('modules/today/index.ts')).not.toContain('TodayHubDag');
  });

  it('resolves the day’s theme on both surfaces', () => {
    for (const page of [hubPage, todayPage]) {
      expect(page).toContain('resolveTodayTheme');
      expect(page).toContain('TodayThemeBanner');
    }
  });
});
