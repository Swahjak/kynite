import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Pairing turns a browser into a device. A member session that was already
 * there must end with it, or a later self-unpair signs the browser back in as
 * that member (the device principal only hides it).
 */

const order: string[] = [];
const signOut = vi.fn(async () => void order.push('signOut'));
const cookieSet = vi.fn(() => void order.push('cookie'));
const redeemPairingCode = vi.fn();

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: 'better-auth.session_token=abc' }),
  cookies: async () => ({ set: cookieSet }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/server/auth', () => ({ getAuth: () => ({ api: { signOut } }) }));
vi.mock('@/modules/family', () => ({ assertCan: vi.fn() }));
vi.mock('@/modules/realtime', () => ({ publish: vi.fn() }));
vi.mock('@/modules/devices/queries', () => ({
  redeemPairingCode: (...args: unknown[]) => redeemPairingCode(...args),
  cancelPairingCode: vi.fn(),
  createPairingCode: vi.fn(),
  renameDevice: vi.fn(),
  revokeDevice: vi.fn(),
}));

const { pairDeviceAction } = await import('@/modules/devices/actions');

beforeEach(() => {
  order.length = 0;
  signOut.mockClear();
  cookieSet.mockClear();
  redeemPairingCode.mockReset();
});

describe('pairDeviceAction and an active member session', () => {
  it('ends the member session before setting the device cookie', async () => {
    redeemPairingCode.mockResolvedValue({
      status: 'paired',
      result: { token: 't', deviceName: 'Keuken' },
    });
    await expect(pairDeviceAction({ code: '123456' })).resolves.toMatchObject({ status: 'paired' });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['signOut', 'cookie']);
  });

  it('leaves the member signed in when the code is wrong', async () => {
    redeemPairingCode.mockResolvedValue({ status: 'invalidCode' });
    await pairDeviceAction({ code: '123456' });
    expect(signOut).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
});
