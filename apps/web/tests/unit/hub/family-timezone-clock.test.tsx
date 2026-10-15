import { act, render, renderHook, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nlMessages from '../../../messages/nl.json';
import { FormattingLocaleProvider } from '@/components/formatting';
import { useHubTheme } from '@/components/hub/use-hub-theme';
import { RoutinesBoard } from '@/modules/today/ui/routines-board';
import type { RoutinesBoardData } from '@/modules/today/page-data-board';

vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  Link: ({ children, href }: { children?: ReactNode; href: string }) => (
    <a href={href} data-testid="routine-progress-card">
      {children}
    </a>
  ),
}));

/**
 * Run under `TZ=UTC` (server/CI) with family zone Europe/Amsterdam (CEST until
 * 2026-10-25). Daypart: 22:30Z is 00:30 local (morning) but hour 22 on the
 * device. Theme: 05:30Z is 07:30 local (light) but before 06:00 on the device.
 */
const wrap = ({ children }: { children: ReactNode }) => (
  <NextIntlClientProvider locale="nl" messages={nlMessages} timeZone="Europe/Amsterdam">
    <FormattingLocaleProvider formattingLocale="nl-NL">{children}</FormattingLocaleProvider>
  </NextIntlClientProvider>
);

const colorClasses = {} as RoutinesBoardData['columns'][number]['colorClasses'];

function boardAt(now: Date): RoutinesBoardData {
  const row = {
    kind: 'routine' as const,
    id: 's1',
    title: 'Tanden',
    icon: 'tooth',
    accentClass: '',
    stars: 1,
    done: false,
    routineId: 'r1',
    routineStepId: 's1',
    memberId: 'm1',
    occurrenceDate: '2026-10-15',
    clientId: 'c1',
  } as unknown as RoutinesBoardData['columns'][number]['sections']['morning'][number];
  return {
    timeZone: 'Europe/Amsterdam',
    now,
    pool: [],
    canCompleteRoutines: true,
    canCompleteTasks: true,
    columns: [
      {
        memberId: 'm1',
        displayName: 'Noor',
        avatarUrl: null,
        colorClasses,
        role: 'child',
        sections: { morning: [row], afternoon: [], evening: [] },
        tasks: [],
      },
    ],
  };
}

describe('family timezone, not device timezone', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('picks the routines daypart from the family clock', () => {
    // 22:30Z = 00:30 Amsterdam -> morning card. Device (UTC) hour 22 -> evening.
    const now = new Date('2026-10-14T22:30:00Z');
    vi.setSystemTime(now);
    render(<RoutinesBoard board={boardAt(now)} dayKey="2026-10-15" toggleTaskAction={vi.fn()} />, {
      wrapper: wrap,
    });
    expect(screen.queryByTestId('routine-progress-card')).not.toBeNull();
  });

  it('resolves the auto theme clock rule from the family clock', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('no-preference'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.setSystemTime(new Date('2026-10-15T05:30:00Z')); // 07:30 Amsterdam
    const { result } = renderHook(() => useHubTheme(), { wrapper: wrap });
    act(() => {});
    expect(result.current.theme).toBe('light');
    vi.unstubAllGlobals();
  });
});
