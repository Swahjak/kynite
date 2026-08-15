import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RewardCard } from '@kynite/ui';
import type { StoreTile } from '@/modules/rewards/page-data';

/**
 * The store tile's contract, asserted on the DOM rather than on a snapshot:
 * what each state renders, what it lets a child do, and — the part that
 * matters most — what none of them ever render.
 */

const tile = (overrides: Partial<StoreTile> = {}): StoreTile => ({
  id: 'reward-1',
  title: 'Extra verhaaltje',
  icon: 'menu_book',
  category: 'privilege',
  costStars: 5,
  state: 'affordable',
  starsShort: 0,
  clientId: 'redeem:member-1:reward-1:2026-03-11',
  ...overrides,
});

const copy = {
  cost: '5 sterren',
  shortHint: 'Nog 7 sterren',
  requestedLabel: 'Gevraagd — wachten op antwoord',
  actionLabel: 'Extra verhaaltje vragen',
};

describe('an affordable reward', () => {
  it('is one tap, with no confirmation step in between', async () => {
    const onRequest = vi.fn();
    render(<RewardCard tile={tile()} copy={copy} onRequest={onRequest} />);

    await userEvent.click(screen.getByRole('button', { name: copy.actionLabel }));

    expect(onRequest).toHaveBeenCalledTimes(1);
    // No dialog appeared between the tap and the call.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows the price and carries no hint', () => {
    render(<RewardCard tile={tile()} copy={copy} onRequest={vi.fn()} />);

    expect(screen.getByTestId('reward-cost')).toHaveTextContent('5');
    expect(screen.queryByTestId('reward-short-hint')).toBeNull();
  });
});

describe('a reward out of reach', () => {
  const outOfReach = tile({ state: 'outOfReach', costStars: 50, starsShort: 7 });

  it('is dimmed rather than marked, and is not tappable', () => {
    render(<RewardCard tile={outOfReach} copy={copy} onRequest={vi.fn()} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('reward-tile')).toHaveAttribute('data-state', 'outOfReach');
  });

  it('counts up to the reward instead of reporting a shortfall', () => {
    render(<RewardCard tile={outOfReach} copy={copy} onRequest={vi.fn()} />);

    const hint = screen.getByTestId('reward-short-hint');
    expect(hint).toHaveTextContent('Nog 7 sterren');
    // The hint is quiet secondary text, never an alarm colour.
    expect(hint.className).toContain('text-ink-secondary');
    expect(hint.className).not.toMatch(/destructive|text-red|text-error/);
  });

  it('renders no lock, cross or failure glyph', () => {
    const { container } = render(<RewardCard tile={outOfReach} copy={copy} onRequest={vi.fn()} />);

    const iconNames = [...container.querySelectorAll('[data-icon-name]')].map((node) =>
      node.getAttribute('data-icon-name')
    );

    for (const banned of ['close', 'cancel', 'error', 'block', 'lock', 'do_not_disturb']) {
      expect(iconNames, `renders a ${banned} glyph`).not.toContain(banned);
    }
  });
});

describe('a reward already asked for', () => {
  const requested = tile({ state: 'requested' });

  it('shows the waiting badge and refuses a second tap', () => {
    const onRequest = vi.fn();
    render(<RewardCard tile={requested} copy={copy} onRequest={onRequest} />);

    expect(screen.getByTestId('reward-requested')).toHaveTextContent(copy.requestedLabel);
    expect(screen.queryByRole('button')).toBeNull();
    expect(onRequest).not.toHaveBeenCalled();
  });

  it('waits with an hourglass, not a spinner', () => {
    const { container } = render(<RewardCard tile={requested} copy={copy} onRequest={vi.fn()} />);

    const icons = [...container.querySelectorAll('[data-icon-name]')].map((node) =>
      node.getAttribute('data-icon-name')
    );

    // An answer may take until after dinner; a spinner promises seconds.
    expect(icons).toContain('hourglass_top');
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});

describe('across every state', () => {
  it('never renders a negative star count', () => {
    for (const state of ['affordable', 'outOfReach', 'requested'] as const) {
      const { container, unmount } = render(
        <RewardCard tile={tile({ state, starsShort: 7 })} copy={copy} onRequest={vi.fn()} />
      );

      expect(container.textContent ?? '').not.toMatch(/[-−]\s*\d/);
      unmount();
    }
  });

  it('uses exactly one dimming treatment for "not yet"', () => {
    const { container: reachable } = render(
      <RewardCard tile={tile()} copy={copy} onRequest={vi.fn()} />
    );
    const { container: unreachable } = render(
      <RewardCard tile={tile({ state: 'outOfReach', starsShort: 7 })} copy={copy} />
    );

    expect(reachable.querySelector('[data-testid="reward-tap"]')?.className).not.toContain(
      'opacity-60'
    );
    // One opacity, and nothing else differs structurally: same tile, same
    // layout, same colours — the routine board's treatment for a step that has
    // not happened yet.
    expect(unreachable.innerHTML).toContain('opacity-60');
  });
});
