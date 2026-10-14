import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/offline', () => ({
  clearUserCachesWithin: async () => {
    calls.push('clear');
  },
}));
vi.mock('@/modules/devices/actions', () => ({
  pairDeviceAction: async () => {
    calls.push('pair');
    return { status: 'error', error: 'invalid' };
  },
}));

const { PairCodeForm } = await import('@/modules/devices/ui/pair-code-form');

describe('pair screen', () => {
  it('clears the per-family caches before it pairs', async () => {
    render(<PairCodeForm />);
    for (const digit of '123456') fireEvent.click(screen.getByTestId(`pair-key-${digit}`));
    fireEvent.click(screen.getByTestId('pair-submit'));

    await waitFor(() => expect(calls).toEqual(['clear', 'pair']));
  });
});
