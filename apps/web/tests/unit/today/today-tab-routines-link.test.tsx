import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';
import type { KidProgress } from '@/modules/today/page-data';

/**
 * The wall's routine cards link to `/routines/[memberId]` — the child's own
 * routine page, which a member and a device share since H3 (its gate is
 * `requireMemberOrDevice`, not the removed `requireHubDevice`).
 *
 * `TodayTabDag` only ever mounts this panel on the `hub` surface and always
 * passes `hub` (`today-tab-dag.tsx`), so in the current tree every real caller
 * gets the link. The `hub` prop's inert branch is now dead — nothing calls
 * this component without it — but it is kept, and the second case below pins
 * that the inert branch still renders no link rather than a broken one.
 */

vi.mock('server-only', () => ({}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key}(${JSON.stringify(values)})` : `${namespace}.${key}`,
}));

vi.mock('@/modules/family', async () => {
  const { MEMBER_COLOR_CLASSES } = await vi.importActual<
    typeof import('@/modules/family/ui/tokens')
  >('@/modules/family/ui/tokens');

  return { MEMBER_COLOR_CLASSES };
});

const { TodayTabRoutines } = await import('@/modules/today/ui/today-tab-routines');

function kid(): KidProgress {
  return {
    memberId: 'm1',
    displayName: 'Mila',
    avatarUrl: null,
    color: 'blue' as Member['color'],
    doneSteps: 2,
    totalSteps: 4,
    ratio: 0.5,
    starsToday: 3,
    starBalance: 10,
    steps: [],
  } as unknown as KidProgress;
}

describe('TodayTabRoutines — the card links only on the wall', () => {
  it('renders a link to the routine page when hub', async () => {
    const { container } = render(await TodayTabRoutines({ kids: [kid()], hub: true }));

    const link = container.querySelector('a[href="/routines/m1"]');
    expect(link).not.toBeNull();
  });

  it('renders no link on the inert (non-hub) branch', async () => {
    const { container } = render(await TodayTabRoutines({ kids: [kid()] }));

    expect(container.querySelector('a')).toBeNull();
  });
});
