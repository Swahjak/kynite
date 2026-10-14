import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H4 review: every `/manage/*` page sits behind one gate — the layout — and the
 * index repeats it. Role by role: a device goes to its board, nobody to
 * sign-in, a member without `routine:write` (child, caregiver) to the board, a
 * manager through.
 */

type Href = string | { pathname: string };
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
vi.mock('@/modules/family', () => ({
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
// The loaders are never reached for a denied caller; stub the slices so the
// pages import without a database.
const slice = new Proxy(
  {},
  {
    get: (_t, key) =>
      typeof key === 'symbol' || key === 'then' || key === '__esModule' ? undefined : () => null,
  }
);
for (const m of [
  '@/modules/calendar',
  '@/modules/routines',
  '@/modules/weather',
  '@/modules/google',
  '@/modules/rewards',
  '@/modules/sharing',
  '@/modules/ics',
]) {
  vi.doMock(m, () => slice);
}
type Page = (props: unknown) => Promise<unknown>;
const pages: (readonly [string, Page])[] = [
  ['page family', (await import('@/app/[locale]/(app)/manage/family/page')).default as Page],
  ['page rewards', (await import('@/app/[locale]/(app)/manage/rewards/page')).default as Page],
  ['page routines', (await import('@/app/[locale]/(app)/manage/routines/page')).default as Page],
  ['page settings', (await import('@/app/[locale]/(app)/manage/settings/page')).default as Page],
  [
    'page settings/devices',
    (await import('@/app/[locale]/(app)/manage/settings/devices/page')).default as Page,
  ],
  [
    'page settings/google',
    (await import('@/app/[locale]/(app)/manage/settings/google/page')).default as Page,
  ],
  [
    'page settings/sharing',
    (await import('@/app/[locale]/(app)/manage/settings/sharing/page')).default as Page,
  ],
  [
    'page settings/subscriptions',
    (await import('@/app/[locale]/(app)/manage/settings/subscriptions/page')).default as Page,
  ],
];

const subjects = [
  ['layout', () => ManageLayout({ children: 'child', params }), true],
  ['index', () => ManagePage({ params }), true],
  // Past the gate a page hits its (stubbed) loader, which may 404 — only the gate is under test.
  ...pages.map(
    ([name, Page]) =>
      [name, () => Page({ params, searchParams: Promise.resolve({}) }), false] as const
  ),
] as const;

const passes = async (run: () => unknown, strict: boolean) => {
  if (strict) await expect(Promise.resolve(run())).resolves.not.toBeNull();
  else await Promise.resolve(run()).catch(() => undefined);
  expect(redirect).not.toHaveBeenCalled();
};

describe.each(subjects)('/manage gate (%s)', (_name, run, strict) => {
  beforeEach(() => {
    redirect.mockClear();
    can.mockReset();
    getPrincipal.mockReset();
  });

  it('sends a paired device to /today', async () => {
    getPrincipal.mockResolvedValue({ kind: 'device', familyId: 'f1' });
    await expect(run()).rejects.toThrow('REDIRECT:/today');
  });

  it('sends nobody to sign-in', async () => {
    getPrincipal.mockResolvedValue(null);
    await expect(run()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('sends a member without routine:write (child) to /today', async () => {
    getPrincipal.mockResolvedValue(member);
    can.mockReturnValue(false);
    await expect(run()).rejects.toThrow('REDIRECT:/today');
    expect(can).toHaveBeenCalledWith(member, 'routine:write', { familyId: 'f1' });
  });

  it('lets a manager through', async () => {
    getPrincipal.mockResolvedValue(member);
    can.mockReturnValue(true);
    await passes(run, strict);
  });
});

describe.each(subjects)('/manage gate (%s), real can()', (_name, run, strict) => {
  beforeEach(() => {
    redirect.mockClear();
    can.mockReset();
    can.mockImplementation((...args: Parameters<typeof realCan>) => realCan(...args));
    getPrincipal.mockReset();
  });

  it('keeps a real child principal out, per the permission matrix', async () => {
    getPrincipal.mockResolvedValue({ ...member, role: 'child' });
    await expect(run()).rejects.toThrow('REDIRECT:/today');
  });

  it('lets a real owner principal in', async () => {
    getPrincipal.mockResolvedValue({ ...member, role: 'owner' });
    await passes(run, strict);
  });
});
