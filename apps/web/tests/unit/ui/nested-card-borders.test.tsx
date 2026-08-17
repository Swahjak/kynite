import { render, screen } from '@testing-library/react';
import { MediaRow, RewardCard, StepRow } from '@kynite/ui';
import { describe, expect, it } from 'vitest';

/**
 * "A 1px `outline-variant` border is used **only** where the card sits directly
 * on the background; cards nested inside another card and rows inside a list
 * use tonal fill or a hairline divider instead, never their own border."
 *
 * The rule is about *placement*, so it cannot be enforced by a source scan —
 * the same class is right on one surface and wrong on another. What is pinned
 * here is the handful of composites whose placement is fixed by construction:
 *
 *  - `StepRow variant="tile"` only ever renders inside `RoutineCard`'s expanded
 *    grid, so it is always nested;
 *  - `RewardCard` only ever renders in the store's grid on the page ground, so
 *    it is always top-level;
 *  - `MediaRow` is the one that does both, and says which through its variant.
 */

const REWARD_COPY = {
  cost: '5 sterren',
  shortHint: 'nog 12',
  requestedLabel: 'Papa kijkt ernaar',
  actionLabel: 'Vraag Film uitkiezen aan',
};

/** Any border-width utility — `border`, `border-2`, `border-x`, `border-t-4`. */
const BORDER_WIDTH = /(?:^|\s)border(?:-[xytrbles])?(?:-\d+)?(?=\s|$)/;

function classesOf(element: Element | null): string {
  return element?.getAttribute('class') ?? '';
}

describe('nested surfaces carry no border of their own', () => {
  it('draws the step tile as a tonal fill, not an outline', () => {
    render(
      <ul>
        <StepRow
          variant="tile"
          stepId="s1"
          title="Tanden poetsen"
          done={false}
          timerSeconds={null}
          praiseText="Goed gedaan!"
          stars={1}
          starLabel="1 ster"
          actionLabel="Markeer Tanden poetsen als klaar"
        />
      </ul>
    );

    const tile = screen.getByTestId('step-tap');
    expect(classesOf(tile)).not.toMatch(BORDER_WIDTH);
    // The separation has to come from somewhere: a tonal ground.
    expect(classesOf(tile)).toMatch(/bg-surface-container/);
  });

  it('keeps the step tile borderless once done', () => {
    render(
      <ul>
        <StepRow
          variant="tile"
          stepId="s1"
          title="Tanden poetsen"
          done
          timerSeconds={null}
          praiseText="Goed gedaan!"
          stars={1}
          starLabel="1 ster"
          actionLabel="Markeer Tanden poetsen als klaar"
        />
      </ul>
    );

    const tile = screen.getByTestId('step-tap');
    expect(classesOf(tile)).not.toMatch(BORDER_WIDTH);
    expect(classesOf(tile)).toMatch(/bg-cat-green-surface/);
  });

  it('keeps the border on a reward tile, which sits on the page ground', () => {
    render(
      <ul>
        <RewardCard
          tile={{
            id: 'r1',
            title: 'Film uitkiezen',
            icon: 'star',
            costStars: 5,
            state: 'affordable',
          }}
          copy={REWARD_COPY}
        />
      </ul>
    );

    expect(classesOf(screen.getByTestId('reward-tile'))).toMatch(BORDER_WIDTH);
  });

  describe('MediaRow — the one that renders both ways', () => {
    it('has no border when tinted, the nested reading', () => {
      const { container } = render(<MediaRow variant="tinted" title="Tandenpoetsen" />);
      const row = container.querySelector('[data-slot="media-row"]');

      expect(classesOf(row)).not.toMatch(BORDER_WIDTH);
      expect(classesOf(row)).toMatch(/bg-surface-container/);
    });

    it('has a hairline border when outlined, the top-level reading', () => {
      const { container } = render(<MediaRow variant="outlined" title="Tandenpoetsen" />);
      const row = container.querySelector('[data-slot="media-row"]');

      // One pixel, not two: the emphasis width is reserved.
      expect(classesOf(row)).toMatch(BORDER_WIDTH);
      expect(classesOf(row)).not.toMatch(/border-2/);
    });
  });
});
