import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '../../../messages/nl.json';
import { RealtimeProvider } from '@/components/realtime';
// Deep imports, deliberately: `@/modules/timers` (the barrel) re-exports
// `server-only` reads alongside its client pieces, and this is a `dom`-project
// test with no `server-only` stub (only the `node` project aliases it away —
// see `vitest.config.ts`) — importing the barrel here fails exactly the way it
// would in a real client bundle. `no-restricted-imports` is off for `tests/**`
// for this reason.
import { RailTimerTile } from '@/modules/timers/ui/rail-timer-tile';
import type { TimerBoardData, TimerView } from '@/modules/timers/page-data';

/**
 * `HubRail`'s conditional fifth tile (M-T2).
 *
 * `HubRail` itself may not import `@/modules/timers` (the boundary
 * `RailTimerTile`'s own doc comment explains), so this is the one place the
 * tile's two contracts are actually exercised: it draws nothing at all with
 * no timers, and once one is running its fill tracks the soonest-ending
 * timer's elapsed fraction.
 */

let pathname = '/hub';
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, href, ...props }: React.ComponentProps<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  usePathname: () => pathname,
}));

// The tile reads `?now=` itself (its own doc comment: a layout is never
// handed `searchParams`, so this is the pin's only route in) — same
// `next/navigation` hook `idle-return.tsx` already uses for the same pin.
const searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}));

function timer(overrides: Partial<TimerView> = {}): TimerView {
  return {
    id: 'timer-1',
    label: 'Schoenen aan',
    durationSeconds: 300,
    startedAt: Date.parse('2026-08-06T07:30:00.000Z'),
    stoppedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    warningLeadSeconds: null,
    memberId: null,
    memberName: null,
    memberColor: null,
    routineId: null,
    routineStepId: null,
    icon: null,
    routineIcon: null,
    ...overrides,
  };
}

function board(timers: TimerView[], serverNow: number): TimerBoardData {
  // `frozen: true` — the tile's own live tick is not what this test is
  // about, and a frozen board keeps `useTimerChannel` from arming a
  // real-clock offset measurement that would make the fill assertion racy.
  return { familyId: 'family-1', serverNow, timers, frozen: true };
}

function renderTile(initial: TimerBoardData) {
  return render(
    <NextIntlClientProvider locale="nl" messages={messages}>
      <RealtimeProvider enabled={false}>
        <RailTimerTile initial={initial} />
      </RealtimeProvider>
    </NextIntlClientProvider>
  );
}

describe('RailTimerTile', () => {
  it('renders nothing when no timer is running', () => {
    pathname = '/hub';
    const { container } = renderTile(board([], Date.parse('2026-08-06T07:30:00.000Z')));
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the tile once a timer is running, linking to /hub/timer', () => {
    pathname = '/hub';
    const now = Date.parse('2026-08-06T07:30:00.000Z');
    renderTile(board([timer()], now));

    const tile = screen.getByTestId('hub-rail-timer');
    expect(tile).toHaveAttribute('href', '/hub/timer');
    expect(screen.queryByTestId('hub-rail-timer-count')).not.toBeInTheDocument();
  });

  it("fills to the soonest-ending timer's elapsed fraction", () => {
    pathname = '/hub';
    const startedAt = Date.parse('2026-08-06T07:30:00.000Z');
    // 300s duration, 150s elapsed → half filled.
    const now = startedAt + 150_000;
    renderTile(board([timer({ startedAt, durationSeconds: 300 })], now));

    const fill = screen.getByTestId('hub-rail-timer-fill');
    expect(fill).toHaveStyle({ height: '50%' });
  });

  it('shows a count badge once more than one timer is running', () => {
    pathname = '/hub';
    const now = Date.parse('2026-08-06T07:30:00.000Z');
    renderTile(board([timer({ id: 'a' }), timer({ id: 'b', startedAt: now + 60_000 })], now));

    expect(screen.getByTestId('hub-rail-timer-count')).toHaveTextContent('2');
  });

  it('marks itself active on /hub/timer', () => {
    pathname = '/hub/timer';
    const now = Date.parse('2026-08-06T07:30:00.000Z');
    renderTile(board([timer()], now));

    expect(screen.getByTestId('hub-rail-timer')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('hub-rail-timer')).toHaveAttribute('aria-current', 'page');
  });

  it('shows a paused indication and freezes the fill while paused', () => {
    pathname = '/hub';
    const startedAt = Date.parse('2026-08-06T07:30:00.000Z');
    const pausedAt = startedAt + 150_000;
    renderTile(board([timer({ startedAt, durationSeconds: 300, pausedAt })], pausedAt + 999_000));

    expect(screen.getByTestId('hub-rail-timer')).toHaveAttribute('data-paused', 'true');
    const fill = screen.getByTestId('hub-rail-timer-fill');
    // Frozen at the instant it was paused (50%), not wherever `now` has since
    // drifted to.
    expect(fill).toHaveStyle({ height: '50%' });
  });
});
