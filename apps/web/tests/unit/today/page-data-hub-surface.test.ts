import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/today` and `/calendar` both read through `loadHubBoardComposition`. Its
 * calendar read must be `surface: 'hub'` (private events busy-only) only for a
 * paired device; a signed-in member sees her own detail.
 */

vi.mock('server-only', () => ({}));

const loadCalendarPage = vi.fn();
const getPrincipal = vi.fn();

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

describe('loadHubBoardComposition: calendar surface follows the principal', () => {
  it.each([
    ['device', 'hub'],
    ['member', 'app'],
  ])('a %s principal reads the calendar as surface %s', async (kind, surface) => {
    getPrincipal.mockResolvedValue({ kind, familyId: 'family-1' });

    await loadHubBoardComposition({ date: '2026-08-15' });

    expect(loadCalendarPage).toHaveBeenCalledWith(expect.objectContaining({ surface }));
  });
});
