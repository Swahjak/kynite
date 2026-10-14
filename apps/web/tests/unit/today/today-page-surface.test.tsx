import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * What `(main)/today` still decides per surface (M3).
 *
 * H3 merged the phone and wall routes into one page; the surface (`app` vs
 * `hub`) is decided by the principal and must vary **presentation only** — the
 * greeting, the viewer, the board container and the FAB's actions. These are
 * exactly what the merge originally dropped from the phone, so each is pinned
 * here against the real page (the components the page forwards *to* are mocked
 * as prop recorders, never to render the thing being asserted):
 *
 *  1. `app` greets the viewer by first name (`common.greeting.<slot>`);
 *     `hub` greets the household (`today.hubGreeting.<slot>`);
 *  2. `app` hands `TodayHeader` a `viewer`; `hub` hands none;
 *  3. `app` renders `data-testid="today-board"` on the phone's `max-w-7xl`
 *     `flex-1` column; `hub` renders `data-testid="hub-board"` on the wall's
 *     full-frame `h-full` board;
 *  4. `app` resolves the FAB's `newEventAction` and `taskAction`; `hub` never
 *     does (it passes `null` for both).
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const MEMBER = {
  id: 'm1',
  familyId: 'family-1',
  displayName: 'Sanne de Vries',
  role: 'parent',
  color: 'blue',
  avatarUrl: null,
  sortOrder: 0,
  birthday: null,
  starBalance: 0,
};

const getPrincipal = vi.hoisted(() => vi.fn());

vi.mock('@/modules/family', () => ({
  firstNameOf: (name: string) => name.split(' ')[0],
  getMember: async () => MEMBER,
  getPrincipal: () => getPrincipal(),
}));

vi.mock('@/modules/calendar', () => ({
  AddEventFabAction: () => <div data-testid="add-event-fab-action" />,
  HubBoard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/modules/devices', () => ({
  requireMemberOrDevice: async () => undefined,
}));

const getSurface = vi.fn();
const DEVICE = { kind: 'device', familyId: 'family-1', deviceId: 'd1' };
const MEMBER_PRINCIPAL = { kind: 'member', familyId: 'family-1', memberId: 'm1' };

vi.mock('@/modules/surface', () => ({
  getSurface: (...args: unknown[]) => getSurface(...args),
  presentationFor: (surface: string) => (surface === 'app' ? 'app' : 'hub'),
}));

vi.mock('@/modules/tasks', () => ({
  TaskComposerFabAction: () => <div data-testid="task-composer-fab-action" />,
}));

const todayHeaderProps = vi.fn();
const todayFabProps = vi.fn();
const loadHubBoardComposition = vi.fn();

vi.mock('@/modules/today', () => ({
  TodayFab: (props: Record<string, unknown>) => {
    todayFabProps(props);
    return <div data-testid="today-fab" />;
  },
  TodayFilterProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TodayHeader: (props: Record<string, unknown>) => {
    todayHeaderProps(props);
    return <div data-testid="today-header" />;
  },
  TodayLive: () => null,
  TodayTabDag: () => <div data-testid="today-dag" />,
  TodayThemeBanner: () => null,
  loadHubBoardComposition: (...args: unknown[]) => loadHubBoardComposition(...args),
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

vi.mock('@/modules/weather', () => ({
  WeatherWidget: () => null,
}));

const TodayPage = (await import('@/app/[locale]/(main)/today/page')).default;

const NOW = new Date('2026-08-15T09:00:00.000Z');

async function renderPage(surface: 'app' | 'hub' | 'desktop', principal?: object) {
  getSurface.mockResolvedValue(surface);
  // A paired device is the `hub` surface; every other surface is a signed-in
  // member unless a test says otherwise.
  getPrincipal.mockResolvedValue(principal ?? (surface === 'hub' ? DEVICE : MEMBER_PRINCIPAL));

  loadHubBoardComposition.mockResolvedValue({
    data: {
      familyId: 'family-1',
      now: NOW,
      anchor: NOW,
      timeZone: 'Europe/Amsterdam',
      events: [],
      members: [MEMBER],
      calendars: [],
      view: 'day',
      weekStartsOn: 1,
      canWrite: true,
    },
    dayKey: '2026-08-15',
    dayEvents: [],
    isToday: true,
    reference: { kind: 'today', now: NOW },
    flow: { mode: 'next', hero: null, live: false, liveBlocks: [] },
    theme: null,
    progress: null,
    tasks: { tasks: [], members: [], canWrite: true, canComplete: true },
    weather: null,
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

describe('(main)/today — what the surface still decides', () => {
  beforeEach(() => {
    getSurface.mockReset();
    todayHeaderProps.mockClear();
    todayFabProps.mockClear();
  });

  it('greets the viewer by first name on the phone', async () => {
    await renderPage('app');

    expect(todayHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ greeting: 'common.greeting.morning' })
    );
  });

  it('greets the household on the hub', async () => {
    await renderPage('hub');

    expect(todayHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ greeting: 'today.hubGreeting.morning' })
    );
  });

  it('hands the phone header the viewer, and the hub header none', async () => {
    await renderPage('app');
    expect(todayHeaderProps).toHaveBeenCalledWith(expect.objectContaining({ viewer: MEMBER }));

    todayHeaderProps.mockClear();
    await renderPage('hub');
    expect(todayHeaderProps).toHaveBeenCalledWith(expect.objectContaining({ viewer: null }));
  });

  it('stamps the phone board and the hub board with their own test ids', async () => {
    const app = await renderPage('app');
    expect(app.container.querySelector('main')?.getAttribute('data-testid')).toBe('today-board');

    const hub = await renderPage('hub');
    expect(hub.container.querySelector('main')?.getAttribute('data-testid')).toBe('hub-board');
  });

  it('gives the phone its own column and the wall its full frame', async () => {
    const app = await renderPage('app');
    const appMain = app.container.querySelector('main')!;
    expect(appMain.className).toContain('max-w-7xl');
    expect(appMain.className).toContain('flex-1');

    const hub = await renderPage('hub');
    const hubMain = hub.container.querySelector('main')!;
    expect(hubMain.className).toContain('h-full');
    expect(hubMain.className).toContain('px-6');
  });

  it('resolves the phone FAB add-event and add-task actions', async () => {
    await renderPage('app');

    expect(todayFabProps).toHaveBeenCalledWith(
      expect.objectContaining({
        newEventAction: expect.anything(),
        taskAction: expect.anything(),
      })
    );
  });

  it('resolves no add-event or add-task action for a paired device', async () => {
    await renderPage('hub');

    expect(todayFabProps).toHaveBeenCalledWith(
      expect.objectContaining({
        newEventAction: null,
        taskAction: null,
      })
    );
  });

  // Review finding: `desktop` maps to the `hub` presentation, so a signed-in
  // member on a laptop used to lose the greeting, the face and both FAB
  // actions. The principal decides these, never the surface.
  it('treats a signed-in member on desktop like a member: greeting, viewer, FAB actions', async () => {
    await renderPage('desktop');

    expect(todayHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ greeting: 'common.greeting.morning', viewer: MEMBER })
    );
    expect(todayFabProps).toHaveBeenCalledWith(
      expect.objectContaining({
        newEventAction: expect.anything(),
        taskAction: expect.anything(),
      })
    );
  });

  it('still keeps the wall frame for a desktop member (presentation only)', async () => {
    const { container } = await renderPage('desktop');

    expect(container.querySelector('main')?.getAttribute('data-testid')).toBe('hub-board');
  });
});
