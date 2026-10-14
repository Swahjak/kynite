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
 *  4. the one day route renders the same panel on both surfaces, so the fork
 *     cannot come back.
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
  TodayTimeline: ({
    density,
    nowEventKeys,
    foldLive,
  }: {
    density?: string;
    nowEventKeys?: string[];
    foldLive?: boolean;
  }) => (
    <div
      data-testid="today-timeline"
      data-density={density ?? 'list'}
      data-now-keys={(nowEventKeys ?? []).join(',')}
      data-fold-live={String(foldLive)}
    />
  ),
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
  nowEventKeys = [],
}: {
  surface: 'app' | 'hub';
  banner?: ReactNode;
  nowEventKeys?: string[];
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
      nowEventKeys,
      tasks,
      banner,
      heroEvents: [],
      flowMode: 'next',
      referenceNow: NOW,
      kids: [],
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

  it.each(['app', 'hub'] as const)(
    'draws the NU block on %s on an ordinary day',
    async (surface) => {
      const { container } = await renderDag({ surface });

      expect(container.querySelector('[data-testid="today-now"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="today-theme-banner"]')).toBeNull();
    }
  );
});

describe('TodayTabDag — live rows fold only behind the NU strip', () => {
  const attr = (container: HTMLElement, name: string) =>
    container.querySelector('[data-testid="today-timeline"]')!.getAttribute(name);

  it.each(['app', 'hub'] as const)(
    'folds live rows when the NU strip is shown (%s)',
    async (surface) => {
      const { container } = await renderDag({ surface, nowEventKeys: ['a', 'b'] });

      expect(attr(container, 'data-fold-live')).toBe('true');
      expect(attr(container, 'data-now-keys')).toBe('a,b');
    }
  );

  it.each(['app', 'hub'] as const)(
    'keeps them open on a themed day, still telling the timeline which are live (%s)',
    async (surface) => {
      const { container } = await renderDag({ surface, banner: BANNER, nowEventKeys: ['a', 'b'] });

      expect(attr(container, 'data-fold-live')).toBe('false');
      expect(attr(container, 'data-now-keys')).toBe('a,b');
    }
  );
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

// The old "quick actions are never doubled" coverage lived here: the wall's
// grid (`today-quick-actions`) and `TaskList`'s own pills, gated so exactly
// one of the two ever drew. Both are gone — the grid's two tiles and the
// list's two pills all moved onto `TodayFab`, the speed dial each page now
// mounts beside this panel rather than inside it (`today-fab.tsx`) — so there
// is nothing left inside `TodayTabDag` for this describe block to pin. New
// coverage for "the wall's dial has two actions, the phone's has four"
// belongs on `TodayFab` itself, not here.

describe('the one day route renders the same panel on both surfaces', () => {
  // Vitest runs with `apps/web` as its working directory.
  const read = (relative: string) => readFileSync(resolve('src', relative), 'utf8');

  // H3 merged the wall and phone route files into one page (`(main)/today`), so
  // the "second file nobody thought to change" is gone. What must stay true is
  // that the single page mounts the one panel and hands it the surface, rather
  // than re-forking per surface.
  const page = read('app/[locale]/(main)/today/page.tsx');
  // M-R1: the read moved into a loader shared with `/calendar`
  // (`loadHubBoardComposition`), so `resolveTodayTheme` now lives there rather
  // than in the page itself — the page still renders the banner off what the
  // loader hands back.
  const loader = read('modules/today/page-data-hub.ts');

  it('renders <TodayTabDag> with the surface as a prop, for both surfaces', () => {
    expect(page).toContain('<TodayTabDag');
    // One panel for both `surface` values: the surface is passed in, not
    // hard-coded, so `app` and `hub` draw the same component.
    expect(page).toContain('surface={surface}');
  });

  it('has no second day panel to drift against', () => {
    expect(page).not.toContain('TodayHubDag');
    expect(read('modules/today/index.ts')).not.toContain('TodayHubDag');
  });

  it('resolves the day’s theme from the loader, not from a prop', () => {
    expect(loader).toContain('resolveTodayTheme');
    expect(page).toContain('TodayThemeBanner');
  });
});
