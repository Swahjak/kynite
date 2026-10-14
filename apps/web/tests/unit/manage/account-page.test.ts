import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H4 review: a member's own settings live at `/account`, outside the
 * `/manage` gate. There is deliberately no `account/layout` and the page makes
 * no `can()` check — a child reaches it; only a non-member is turned away
 * (by the `(app)` layout, and `loadNotificationsPage` returning null).
 *
 * The page takes no principal: it is read inside `loadNotificationsPage`. So
 * the loader runs for real here and only its edges are faked — `getPrincipal`
 * and the data reads — otherwise "renders for a child" would assert nothing
 * about children.
 */

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
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
vi.mock('@/modules/family', () => ({ getPrincipal: () => getPrincipal() }));
vi.mock('@/modules/notifications/queries', () => ({
  countActiveSubscriptions: async () => 0,
  getNotificationPreferences: async () => ({}),
}));
vi.mock('@/modules/notifications/config', () => ({
  missingPushConfig: () => [],
  pushPublicKey: () => null,
}));
// The real barrel (so the real `loadNotificationsPage`), minus the form.
vi.mock('@/modules/notifications', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/notifications')>()),
  NotificationPreferencesForm: () => null,
}));
vi.mock('@/modules/surface', () => ({
  SurfacePreferenceForm: () => null,
  getSurfacePreference: async () => 'auto',
}));

const { default: AccountPage } = await import('@/app/[locale]/(app)/account/page');

describe('/account', () => {
  beforeEach(() => getPrincipal.mockReset());

  it('renders for a child (any member), with no manage check', async () => {
    getPrincipal.mockResolvedValue({
      kind: 'member',
      familyId: 'f1',
      memberId: 'm-child',
      role: 'child',
    });
    await expect(AccountPage()).resolves.not.toBeNull();
    expect(getPrincipal).toHaveBeenCalled();
  });

  it('is not found for a non-member (nobody, or a paired device)', async () => {
    getPrincipal.mockResolvedValue(null);
    await expect(AccountPage()).rejects.toThrow('NOT_FOUND');
    getPrincipal.mockResolvedValue({ kind: 'device', familyId: 'f1', deviceId: 'd1' });
    await expect(AccountPage()).rejects.toThrow('NOT_FOUND');
  });

  it('has no layout gate of its own', async () => {
    await expect(
      import('node:fs').then((fs) =>
        fs.existsSync(
          new URL('../../../src/app/[locale]/(app)/account/layout.tsx', import.meta.url)
        )
      )
    ).resolves.toBe(false);
  });
});
