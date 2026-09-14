import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@/modules/family';
import type { KidProgress } from '@/modules/today/page-data';

/**
 * The hub dashboard's routine cards link to `/hub/routines/[memberId]`; the
 * same panel on `(app)/today` does not, because that route needs a hub device
 * (`requireHubDevice`) a parent's phone never has.
 *
 * `TodayTabDag` always passes `hub` when it mounts this panel — it only does
 * so on the `hub` surface (`today-dag-surfaces.test.tsx` pins that split) — so
 * `hub` here stands in for "reached from the wall" vs. "reached from
 * `(app)/today`'s own routines tab", which calls this component with no
 * `hub` prop at all.
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

    const link = container.querySelector('a[href="/hub/routines/m1"]');
    expect(link).not.toBeNull();
  });

  it('renders no link on (app)/today, which calls it with no `hub` prop', async () => {
    const { container } = render(await TodayTabRoutines({ kids: [kid()] }));

    expect(container.querySelector('a')).toBeNull();
  });
});
