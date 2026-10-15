import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/timers` is one route for both principals: the principal decides the
 * controls. A member gets `TimerControls`; a paired device gets the
 * quick-start `TimerBoard` and never loads the member-only page data.
 */

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const formatDateTime = vi.fn((..._args: unknown[]) => '09:00');
vi.mock('@/i18n/formatting-locale', () => ({
  formatDateTime: (...args: unknown[]) => formatDateTime(...args),
}));

const requireMemberOrDevice = vi.fn();
vi.mock('@/modules/devices', () => ({
  requireMemberOrDevice: (...args: unknown[]) => requireMemberOrDevice(...args),
}));

const getFamily = vi.fn();
vi.mock('@/modules/family', () => ({
  getFamily: (...args: unknown[]) => getFamily(...args),
  getHouseholdFormattingLocale: async () => 'nl-NL',
}));

const loadTimersPage = vi.fn();
const loadTimerBoard = vi.fn();

vi.mock('@/modules/timers', () => ({
  DURATION_PRESETS: [300],
  TimerBoard: () => <div data-testid="timer-board" />,
  TimerControls: () => <div data-testid="timer-controls" />,
  loadTimerBoard: (...args: unknown[]) => loadTimerBoard(...args),
  loadTimersPage: (...args: unknown[]) => loadTimersPage(...args),
}));

vi.mock('@kynite/ui', () => ({
  EmptyState: () => null,
  PageHeader: () => <div data-testid="page-header" />,
}));

const TimersPage = (await import('@/app/[locale]/(main)/timers/page')).default;

async function renderPage() {
  return render(
    await TimersPage({
      params: Promise.resolve({ locale: 'nl' }),
      searchParams: Promise.resolve({}),
    })
  );
}

describe('(main)/timers — member vs device', () => {
  beforeEach(() => {
    requireMemberOrDevice.mockReset();
    loadTimersPage.mockReset();
    loadTimerBoard.mockReset();
    formatDateTime.mockClear();
    getFamily.mockReset();
    getFamily.mockResolvedValue({ timezone: 'Europe/Amsterdam' });
    loadTimersPage.mockResolvedValue({ familyId: 'family-1' });
    loadTimerBoard.mockResolvedValue({ serverNow: 0 });
  });

  it('gives a member the TimerControls', async () => {
    requireMemberOrDevice.mockResolvedValue({ kind: 'member', familyId: 'family-1' });
    const { container } = await renderPage();

    expect(container.querySelector('[data-testid="timer-controls"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timer-board"]')).toBeNull();
  });

  it('gives a device the quick-start board and never loads the member page data', async () => {
    requireMemberOrDevice.mockResolvedValue({ kind: 'device', familyId: 'family-1' });
    const { container } = await renderPage();

    expect(container.querySelector('[data-testid="timer-board"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timer-controls"]')).toBeNull();
    expect(loadTimersPage).not.toHaveBeenCalled();
  });

  it.each([
    [{ timezone: 'America/New_York' }, 'America/New_York'],
    [null, 'Europe/Amsterdam'],
  ])('formats the wall clock in the family zone (%o -> %s)', async (family, expected) => {
    requireMemberOrDevice.mockResolvedValue({ kind: 'device', familyId: 'family-1' });
    getFamily.mockResolvedValue(family);
    await renderPage();

    expect(formatDateTime).toHaveBeenCalledWith(
      expect.any(Date),
      'nl-NL',
      expect.objectContaining({ timeZone: expected })
    );
  });
});
