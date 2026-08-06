import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StepRow } from '@/modules/routines/ui/step-row';

/**
 * The praise-before-star contract (FR15, research §Decisions 5), asserted
 * structurally rather than visually — the visual snapshot in
 * `e2e/tests/visual/routines.spec.ts` pins the *appearance*, this pins the
 * *order*, and a component cannot satisfy one by breaking the other.
 */

const base = {
  stepId: 'step-1',
  title: 'Brush teeth',
  timerSeconds: null,
  praiseText: 'You did that all by yourself!',
  stars: 1,
  starLabel: '1 star earned',
  actionLabel: 'Mark Brush teeth as done',
};

describe('a completed step', () => {
  it('renders the praise before the star in the DOM', () => {
    render(<StepRow {...base} done />);

    const praise = screen.getByTestId('step-praise');
    const star = screen.getByTestId('step-star');

    // Node.DOCUMENT_POSITION_FOLLOWING === 4: the star comes *after* the praise.
    expect(praise.compareDocumentPosition(star) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('gives the praise heading scale and the star caption scale', () => {
    render(<StepRow {...base} done />);

    expect(screen.getByTestId('step-praise').className).toContain('text-h3');
    // The star's own element carries the small type; the praise never does.
    expect(screen.getByTestId('step-praise').className).not.toContain('text-caption');
    const star = screen.getByTestId('step-star').querySelector('[data-slot="star-pop"]')!;
    expect(star.className).toContain('text-gold-ink');
    expect(star.querySelector('.tabular-time')?.className).toContain('text-caption');
  });

  it('shows the praise text itself, not a generic "done"', () => {
    render(<StepRow {...base} done />);
    expect(screen.getByText(base.praiseText)).toBeInTheDocument();
  });

  it('renders no star at all for a graduated routine — absence, not a struck-out star', () => {
    render(<StepRow {...base} done stars={0} />);

    expect(screen.getByTestId('step-praise')).toBeInTheDocument();
    expect(screen.getByTestId('step-star').querySelector('[data-slot="star-pop"]')).toBeNull();
  });

  it('does not fire a second completion', async () => {
    const onComplete = vi.fn();
    render(<StepRow {...base} done onComplete={onComplete} />);

    await userEvent.click(screen.getByTestId('step-tap'));
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('a step still to do', () => {
  it('is a single tap target with no confirmation and no praise yet', () => {
    render(<StepRow {...base} done={false} />);

    expect(screen.queryByTestId('step-praise')).toBeNull();
    expect(screen.getByRole('button', { name: base.actionLabel })).toBeInTheDocument();
  });

  it('reports where it was tapped, so the celebration lands on the row', async () => {
    const onComplete = vi.fn();
    render(<StepRow {...base} done={false} onComplete={onComplete} />);

    await userEvent.click(screen.getByTestId('step-tap'));

    expect(onComplete).toHaveBeenCalledTimes(1);
    const [origin] = onComplete.mock.calls[0];
    expect(origin.x).toBeGreaterThanOrEqual(0);
    expect(origin.y).toBeGreaterThanOrEqual(0);
  });

  it('shows a timer prescription when the step has one', () => {
    render(<StepRow {...base} done={false} timerSeconds={90} />);
    expect(screen.getByText('1:30')).toBeInTheDocument();
  });

  it('is 56px tall — the single-tap row height, well past the 48px kiosk minimum', () => {
    render(<StepRow {...base} done={false} />);
    // `h-14` is Tailwind's 3.5rem = 56px. jsdom computes no layout, so the
    // class is the assertable contract here; the e2e target-size audit is what
    // measures the rendered box.
    expect(screen.getByTestId('step-tap').className).toContain('h-14');
  });
});
