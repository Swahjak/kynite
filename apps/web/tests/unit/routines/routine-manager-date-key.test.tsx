import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';

/**
 * A one-off routine's schedule line renders its YYYY-MM-DD key read back at
 * noon UTC. The key is already the family's calendar day, so it must be
 * formatted as UTC: Kiritimati (UTC+14, pinned below) would otherwise show the
 * next day.
 */
process.env.TZ = 'Pacific/Kiritimati';

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string, values?: Record<string, unknown>) =>
    values?.date ? `${key}:${String(values.date)}` : key,
}));

vi.mock('@/modules/family', async () => {
  const { MEMBER_COLOR_CLASSES } = await vi.importActual<
    typeof import('@/modules/family/ui/tokens')
  >('@/modules/family/ui/tokens');

  return {
    MEMBER_COLOR_CLASSES,
    getHouseholdFormattingLocale: async () => 'en-GB',
    initialsOf: (name: string) => name.slice(0, 1),
  };
});

vi.mock('@/modules/routines/ui/routine-active-switch', () => ({ RoutineActiveSwitch: () => null }));
vi.mock('@/modules/routines/ui/routine-dialog', () => ({ RoutineDialog: () => null }));
vi.mock('@/modules/routines/ui/graduate-routine-button', () => ({
  GraduateRoutineButton: () => null,
}));

const { RoutineManager } = await import('@/modules/routines/ui/routine-manager');

describe('RoutineManager one-off date key', () => {
  it('shows the key’s own day, whatever the device zone', async () => {
    const member = { id: 'm1', displayName: 'Noor', role: 'child', color: 'blue' } as Member;
    const routine = {
      id: 'r1',
      title: 'Zwemles',
      icon: null,
      active: true,
      ownerMemberId: 'm1',
      starsPerCompletion: 1,
      steps: [],
      createdAt: new Date('2026-09-01T00:00:00Z'),
      schedule: { kind: 'once', date: '2026-09-16' },
    };

    const { container } = render(
      await RoutineManager({
        routines: [routine] as never,
        members: [member],
        owners: [],
        timeZone: 'Europe/Amsterdam',
        canWrite: false,
      })
    );

    expect(container.textContent).toMatch(/schedule\.onceShort:16 Sep/);
  });
});
