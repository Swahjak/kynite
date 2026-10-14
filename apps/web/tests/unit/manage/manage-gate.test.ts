import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H4 review: every `/manage/*` page sits behind one gate — the layout — and the
 * index repeats it. Role by role: a device goes to its board, nobody to
 * sign-in, a member without `routine:write` (child, caregiver) to the board, a
 * manager through.
 */

type Href = string | { pathname: string; query?: Record<string, string> };
const redirect = vi.fn((arg: { href: Href }) => {
  throw new Error(`REDIRECT:${typeof arg.href === 'string' ? arg.href : arg.href.pathname}`);
});
vi.mock('@/i18n/navigation', () => ({ redirect: (arg: { href: Href }) => redirect(arg) }));

// The layout reads the intended path; outside a request scope `headers()` throws.
// (It started doing so after this test was written — the premise moved, not the gate.)
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ has: () => false }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (ns: string) => (key: string) => `${ns}.${key}`,
}));
vi.mock('@/components/settings/settings-shell', () => ({
  SettingsNavRow: () => null,
  SettingsPage: () => null,
  SettingsPageHeader: () => null,
  SettingsSection: () => null,
}));

const getPrincipal = vi.fn();
const can = vi.fn();
const loaders = {
  loadFamilyPage: vi.fn(async () => null),
  loadFamilySettings: vi.fn(async () => null),
  loadRewardsPage: vi.fn(async () => null),
  loadRoutinesPage: vi.fn(async () => null),
  loadDevicesPage: vi.fn(async () => null),
  listLinkedAccounts: vi.fn(async () => []),
  loadSharingPage: vi.fn(async () => null),
  loadSubscriptionsPage: vi.fn(async () => null),
  loadCalendarDisplay: vi.fn(async () => null),
};
vi.mock('@/modules/family', () => ({
  loadFamilyPage: () => loaders.loadFamilyPage(),
  loadFamilySettings: () => loaders.loadFamilySettings(),
  canOwn: () => true,
  getPrincipal: () => getPrincipal(),
  can: (...args: unknown[]) => can(...args),
}));
// The matrix itself, for the one case that must not trust a mocked `can`.
const { can: realCan } = await vi.importActual<typeof import('@/modules/family/authorize')>(
  '@/modules/family/authorize'
);

const { default: ManageLayout } = await import('@/app/[locale]/(app)/manage/layout');
const { default: ManagePage } = await import('@/app/[locale]/(app)/manage/page');

const params = Promise.resolve({ locale: 'nl' });
const member = { kind: 'member', familyId: 'f1', memberId: 'm1' };

// Layouts do not re-run on client navigation, so every page gates itself (R2).
// Loaders are named mocks: a denied caller must never reach one, a manager must.
vi.doMock('@/modules/routines', () => ({ loadRoutinesPage: () => loaders.loadRoutinesPage() }));
vi.doMock('@/modules/rewards', () => ({ loadRewardsPage: () => loaders.loadRewardsPage() }));
vi.doMock('@/modules/sharing', () => ({ loadSharingPage: () => loaders.loadSharingPage() }));
vi.doMock('@/modules/ics', () => ({
  loadSubscriptionsPage: () => loaders.loadSubscriptionsPage(),
}));
vi.doMock('@/modules/google', () => ({
  listLinkedAccounts: () => loaders.listLinkedAccounts(),
  missingGoogleConfig: () => [],
}));
vi.doMock('@/modules/calendar', () => ({
  loadCalendarDisplay: () => loaders.loadCalendarDisplay(),
}));
vi.doMock('@/modules/weather', () => ({}));
vi.doMock('@/modules/devices', async () => ({
  ...(await vi.importActual<object>('@/modules/devices')),
  loadDevicesPage: () => loaders.loadDevicesPage(),
}));

type Page = (props: unknown) => Promise<unknown>;
const pages: (readonly [string, Page, keyof typeof loaders])[] = [
  [
    'page family',
    (await import('@/app/[locale]/(app)/manage/family/page')).default as Page,
    'loadFamilyPage',
  ],
  [
    'page rewards',
    (await import('@/app/[locale]/(app)/manage/rewards/page')).default as Page,
    'loadRewardsPage',
  ],
  [
    'page routines',
    (await import('@/app/[locale]/(app)/manage/routines/page')).default as Page,
    'loadRoutinesPage',
  ],
  [
    'page settings',
    (await import('@/app/[locale]/(app)/manage/settings/page')).default as Page,
    'loadFamilySettings',
  ],
  [
    'page settings/devices',
    (await import('@/app/[locale]/(app)/manage/settings/devices/page')).default as Page,
    'loadDevicesPage',
  ],
  [
    'page settings/google',
    (await import('@/app/[locale]/(app)/manage/settings/google/page')).default as Page,
    'listLinkedAccounts',
  ],
  [
    'page settings/sharing',
    (await import('@/app/[locale]/(app)/manage/settings/sharing/page')).default as Page,
    'loadSharingPage',
  ],
  [
    'page settings/subscriptions',
    (await import('@/app/[locale]/(app)/manage/settings/subscriptions/page')).default as Page,
    'loadSubscriptionsPage',
  ],
];

// [name, run, loader the page reaches once the gate lets a manager through]
const subjects = [
  ['layout', () => ManageLayout({ children: 'child', params }), null],
  ['index', () => ManagePage({ params }), null],
  ...pages.map(
    ([name, Page, loader]) =>
      [name, () => Page({ params, searchParams: Promise.resolve({}) }), loader] as const
  ),
] as const;

const anyLoaderCalled = () => Object.values(loaders).some((fn) => fn.mock.calls.length > 0);

/** Past the gate a page may 404 or redirect on its stubbed (null) data; the loader call proves the gate let us in. */
const passes = async (run: () => unknown, loader: keyof typeof loaders | null) => {
  if (loader === null) {
    await expect(Promise.resolve(run())).resolves.not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
    return;
  }
  await Promise.resolve(run()).catch(() => undefined);
  expect(loaders[loader]).toHaveBeenCalled();
};

describe.each(subjects)('/manage gate (%s)', (_name, run, loader) => {
  beforeEach(() => {
    redirect.mockClear();
    Object.values(loaders).forEach((fn) => fn.mockClear());
    can.mockReset();
    getPrincipal.mockReset();
  });

  it('sends a paired device to /today', async () => {
    getPrincipal.mockResolvedValue({ kind: 'device', familyId: 'f1' });
    await expect(run()).rejects.toThrow('REDIRECT:/today');
    expect(anyLoaderCalled()).toBe(false);
  });

  it('sends nobody to sign-in', async () => {
    getPrincipal.mockResolvedValue(null);
    await expect(run()).rejects.toThrow('REDIRECT:/sign-in');
    const { href } = redirect.mock.calls[0]![0];
    // Pages carry the way back; the layout takes it from the proxy header (null here).
    if (typeof href === 'object') {
      expect((href as { query?: { callbackUrl?: string } }).query?.callbackUrl).toMatch(
        /^\/nl\/manage/
      );
    }
    expect(anyLoaderCalled()).toBe(false);
  });

  it('sends a member without routine:write (child) to /today', async () => {
    getPrincipal.mockResolvedValue(member);
    can.mockReturnValue(false);
    await expect(run()).rejects.toThrow('REDIRECT:/today');
    expect(can).toHaveBeenCalledWith(member, 'routine:write', { familyId: 'f1' });
    expect(anyLoaderCalled()).toBe(false);
  });

  it('lets a manager through', async () => {
    getPrincipal.mockResolvedValue(member);
    can.mockReturnValue(true);
    await passes(run, loader);
  });
});

describe.each(subjects)('/manage gate (%s), real can()', (_name, run, loader) => {
  beforeEach(() => {
    redirect.mockClear();
    Object.values(loaders).forEach((fn) => fn.mockClear());
    can.mockReset();
    can.mockImplementation((...args: Parameters<typeof realCan>) => realCan(...args));
    getPrincipal.mockReset();
  });

  it('keeps a real child principal out, per the permission matrix', async () => {
    getPrincipal.mockResolvedValue({ ...member, role: 'child' });
    await expect(run()).rejects.toThrow('REDIRECT:/today');
    expect(anyLoaderCalled()).toBe(false);
  });

  it('lets a real owner principal in', async () => {
    getPrincipal.mockResolvedValue({ ...member, role: 'owner' });
    await passes(run, loader);
  });
});
