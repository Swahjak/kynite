import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * H4 review: a member's own settings live at `/account`, outside the
 * `/manage` gate. There is deliberately no `account/layout` and the page makes
 * no `can()` check — a child reaches it; only a non-member is turned away
 * (by the `(app)` layout, and `loadNotificationsPage` returning null).
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

const loadNotificationsPage = vi.fn();
vi.mock('@/modules/notifications', () => ({
  NotificationPreferencesForm: () => null,
  loadNotificationsPage: () => loadNotificationsPage(),
}));
vi.mock('@/modules/surface', () => ({
  SurfacePreferenceForm: () => null,
  getSurfacePreference: async () => 'auto',
}));

const { default: AccountPage } = await import('@/app/[locale]/(app)/account/page');

describe('/account', () => {
  beforeEach(() => loadNotificationsPage.mockReset());

  it('renders for a child (any member), with no manage check', async () => {
    loadNotificationsPage.mockResolvedValue({
      preferences: {},
      publicKey: null,
      subscriptionCount: 0,
    });
    await expect(AccountPage()).resolves.not.toBeNull();
  });

  it('is not found for a non-member', async () => {
    loadNotificationsPage.mockResolvedValue(null);
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
