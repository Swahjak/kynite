import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/today` and `/calendar` both read through `loadHubBoardComposition`. Its
 * calendar read must pass `busyOnlyPrivate` (private events busy-only) only for
 * a paired device; a signed-in member sees her own detail. Privacy is decided
 * by `busyOnlyPrivate`, not `surface` (which only picks the layout).
 */

vi.mock('server-only', () => ({}));

const loadCalendarPage = vi.fn();
const getPrincipal = vi.fn();
const getSurface = vi.fn();

vi.mock('@/modules/calendar', () => ({
  dayKeysOf: () => [] as string[],
  isSameDay: () => true,
  loadCalendarPage: (...args: unknown[]) => loadCalendarPage(...args),
  toDateKey: () => '2026-08-15',
  toWall: (date: Date) => date,
}));
vi.mock('@/modules/family', () => ({
  MEMBER_COLOR_CLASSES: {},
  getPrincipal: () => getPrincipal(),
  greetingSlotFor: () => 'morning',
  hourIn: () => 9,
  initialsOf: () => '',
}));
vi.mock('@/modules/surface', () => ({
  getSurface: () => getSurface(),
  presentationFor: (surface: string) => (surface === 'app' ? 'app' : 'hub'),
}));
vi.mock('@/modules/routines', () => ({ instantAt: vi.fn(), loadFamilyRoutineTotals: vi.fn() }));
vi.mock('@/modules/tasks', () => ({ loadTodayTasks: vi.fn() }));
vi.mock('@/modules/weather', () => ({ getFamilyWeather: vi.fn() }));
vi.mock('@/modules/today/page-data', () => ({ loadTodayProgress: vi.fn() }));

const { loadHubBoardComposition } = await import('@/modules/today/page-data-hub');

beforeEach(() => {
  loadCalendarPage.mockReset();
  loadCalendarPage.mockResolvedValue({
    familyId: 'family-1',
    now: new Date('2026-08-15T09:00:00.000Z'),
    anchor: new Date('2026-08-15T00:00:00.000Z'),
    timeZone: 'Europe/Amsterdam',
    events: [],
    members: [],
  });
});

describe('loadHubBoardComposition: privacy follows the principal, layout the surface', () => {
  it.each([
    // [principal, D17 surface, expected layout surface (-> default view), busy-only private]
    ['member', 'desktop', 'hub', false],
    ['member', 'app', 'app', false],
    ['device', 'hub', 'hub', true],
  ])('a %s on the %s surface', async (kind, resolved, surface, busyOnlyPrivate) => {
    getPrincipal.mockResolvedValue({ kind, familyId: 'family-1' });
    getSurface.mockResolvedValue(resolved);

    await loadHubBoardComposition({ date: '2026-08-15' });

    expect(loadCalendarPage).toHaveBeenCalledWith(
      expect.objectContaining({ surface, busyOnlyPrivate })
    );
  });
});
