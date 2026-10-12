import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H4 review: every `/manage/*` page sits behind one gate — the layout — and the
 * index repeats it. Role by role: a device goes to its board, nobody to
 * sign-in, a member without `routine:write` (child, caregiver) to the board, a
 * manager through.
 */

const redirect = vi.fn((arg: { href: string }) => {
  throw new Error(`REDIRECT:${arg.href}`);
});
vi.mock('@/i18n/navigation', () => ({ redirect: (arg: { href: string }) => redirect(arg) }));

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

const { default: ManageLayout } = await import('@/app/[locale]/(app)/manage/layout');
const { default: ManagePage } = await import('@/app/[locale]/(app)/manage/page');

const params = Promise.resolve({ locale: 'nl' });
const member = { kind: 'member', familyId: 'f1', memberId: 'm1' };

const subjects = [
  ['layout', () => ManageLayout({ children: 'child', params })],
  ['index', () => ManagePage({ params })],
] as const;

describe.each(subjects)('/manage gate (%s)', (_name, run) => {
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
    await expect(run()).resolves.not.toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});
