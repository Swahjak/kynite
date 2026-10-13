import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));

class Redirected extends Error {}
const redirect = vi.fn((target: unknown) => {
  throw Object.assign(new Redirected('redirect'), { target });
});
const getPrincipal = vi.fn();

vi.mock('@/i18n/navigation', () => ({ redirect: (t: unknown) => redirect(t) }));
vi.mock('@/modules/family', () => ({
  SignInForm: () => null,
  getPrincipal: () => getPrincipal(),
  hasEverBeenMember: async () => true,
}));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => null } }),
  isSocialSignInConfigured: () => false,
}));

const SignInPage = (await import('@/app/[locale]/(auth)/sign-in/page')).default;

const render = (principal: unknown) => {
  getPrincipal.mockResolvedValue(principal);
  return SignInPage({
    params: Promise.resolve({ locale: 'nl' }),
    searchParams: Promise.resolve({ callbackUrl: '/nl/manage/rewards' }),
  });
};

describe('sign-in page redirects an existing principal', () => {
  it('sends a paired device to /today, ignoring a member callback (no loop with the proxy)', async () => {
    await expect(render({ kind: 'device', familyId: 'f' })).rejects.toBeInstanceOf(Redirected);
    expect(redirect).toHaveBeenCalledWith({ href: '/today', locale: 'nl' });
  });

  it('sends a member on to the callback', async () => {
    redirect.mockClear();
    await expect(render({ kind: 'member', familyId: 'f' })).rejects.toBeInstanceOf(Redirected);
    expect(redirect).toHaveBeenCalledWith({ href: '/manage/rewards', locale: 'nl' });
  });
});
