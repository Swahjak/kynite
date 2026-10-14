import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `loadCalendarPage` makes two independent decisions: which board to draw
 * (`surface`) and how much private-calendar detail to read (`busyOnlyPrivate`,
 * with `principal.kind === 'device'` as a backstop). They must not leak into
 * each other.
 */

vi.mock('server-only', () => ({}));

const getPrincipal = vi.fn();
const getFamily = vi.fn();
const listEvents = vi.fn();
const grade = vi.fn();
const decide = vi.fn();

vi.mock('drizzle-orm', () => ({ and: vi.fn(), asc: vi.fn(), desc: vi.fn(), eq: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: async () => (slug: string) => slug }));
vi.mock('@/server/db/schema', () => ({ calendar: {}, googleAccount: {} }));
vi.mock('@/server/db', () => {
  const chain: Record<string, unknown> = {};
  for (const step of ['select', 'from', 'where']) chain[step] = () => chain;
  chain.orderBy = async () => [];
  return { getDb: () => chain };
});
vi.mock('@/modules/calendar/household', () => ({ ensureHouseholdCalendar: async () => undefined }));
vi.mock('@/modules/calendar/queries', () => ({
  listEvents: (...args: unknown[]) => listEvents(...args),
}));
vi.mock('@/modules/family', () => ({
  can: () => true,
  decide: (...args: unknown[]) => decide(...args),
  getFamily: (...args: unknown[]) => getFamily(...args),
  getPrincipal: () => getPrincipal(),
  grade: (...args: unknown[]) => grade(...args),
  listMembers: async () => [],
}));

const { loadCalendarPage } = await import('@/modules/calendar/page-data');

const member = { kind: 'member', familyId: 'fam', memberId: 'm1' };
const device = { kind: 'device', familyId: 'fam' };

const listArgs = () => listEvents.mock.calls[0]![0] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  getPrincipal.mockResolvedValue(member);
  getFamily.mockResolvedValue({
    timezone: 'Europe/Amsterdam',
    weekStartsOn: 1,
    hubDefaultView: 'week',
  });
  listEvents.mockResolvedValue([]);
  grade.mockReturnValue('allow');
  decide.mockReturnValue('allow');
});

describe('loadCalendarPage private detail', () => {
  it('busyOnlyPrivate forces busy-only even for a member who may see detail', async () => {
    await loadCalendarPage({ surface: 'app', busyOnlyPrivate: true });
    expect(listArgs()).toMatchObject({ privateDetail: false, privateDetailFor: null });
  });

  it('a member without the flag gets detail per grade, whatever the surface', async () => {
    for (const surface of ['app', 'hub'] as const) {
      listEvents.mockClear();
      await loadCalendarPage({ surface });
      expect(listArgs()).toMatchObject({ privateDetail: true });
    }
  });

  it('an own-grade member is scoped to her own member id', async () => {
    grade.mockReturnValue('own');
    await loadCalendarPage({ surface: 'app' });
    expect(listArgs()).toMatchObject({ privateDetail: false, privateDetailFor: 'm1' });
  });

  it('a device principal is busy-only even when the caller omits the flag', async () => {
    getPrincipal.mockResolvedValue(device);
    await loadCalendarPage({ surface: 'hub' });
    expect(listArgs()).toMatchObject({ privateDetail: false, privateDetailFor: null });
  });
});

describe('loadCalendarPage default view', () => {
  it("takes the family's hubDefaultView on the hub surface", async () => {
    expect((await loadCalendarPage({ surface: 'hub' }))?.view).toBe('week');
  });

  it('defaults to day on the app surface', async () => {
    expect((await loadCalendarPage({ surface: 'app' }))?.view).toBe('day');
  });

  it('an explicit ?view= wins on the hub', async () => {
    expect((await loadCalendarPage({ surface: 'hub', view: 'month' }))?.view).toBe('month');
  });
});
