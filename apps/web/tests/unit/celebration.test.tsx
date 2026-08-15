import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import confetti from 'canvas-confetti';
import {
  CELEBRATION_COLORS,
  CELEBRATION_INTENSITIES,
  CELEBRATION_LIMITS,
  CELEBRATION_PRESETS,
  StarPop,
  fireConfettiBurst,
} from '@/components/celebration';

/**
 * The celebration presets carry a safety promise (M07: "non-strobing and
 * intensity-configurable"), so they are asserted rather than eyeballed.
 *
 * `canvas-confetti` is mocked at the module level rather than through a
 * production test seam — `fireConfettiBurst` loads it via a dynamic
 * `import()`, so a call is observed by awaiting the mock rather than reading
 * it back synchronously.
 */

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const confettiMock = vi.mocked(confetti);

afterEach(() => {
  confettiMock.mockClear();
  vi.unstubAllGlobals();
});

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduce && query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList
  );
}

describe('presets', () => {
  it('offers a real intensity dial rather than an on/off', () => {
    expect([...CELEBRATION_INTENSITIES]).toEqual(['gentle', 'standard', 'big']);

    const counts = CELEBRATION_INTENSITIES.map(
      (intensity) => CELEBRATION_PRESETS[intensity].particleCount
    );
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(new Set(counts).size).toBe(counts.length);
  });

  it('bounds every preset so a burst cannot linger or flicker', () => {
    for (const intensity of CELEBRATION_INTENSITIES) {
      const preset = CELEBRATION_PRESETS[intensity];
      expect(preset.ticks).toBeLessThanOrEqual(CELEBRATION_LIMITS.maxTicks);
      expect(preset.particleCount).toBeLessThanOrEqual(CELEBRATION_LIMITS.maxParticleCount);
      expect(preset.durationMs).toBeLessThanOrEqual(CELEBRATION_LIMITS.maxDurationMs);
      // Decay < 1 with gravity > 0: particles always settle. A preset that
      // did not would keep repainting at the bottom of a wall display.
      expect(preset.decay).toBeGreaterThan(0);
      expect(preset.decay).toBeLessThan(1);
      expect(preset.gravity).toBeGreaterThan(0);
    }
  });

  it('uses no red — a red particle reads as an alert, and nothing here alerts', () => {
    for (const color of CELEBRATION_COLORS) {
      const [, r, g, b] = /^#(\w{2})(\w{2})(\w{2})$/.exec(color)!;
      const red = Number.parseInt(r, 16);
      const green = Number.parseInt(g, 16);
      const blue = Number.parseInt(b, 16);
      // Red hue = dominant red with both other channels dark. Amber
      // (#fea619) has a bright green channel and is not that.
      expect(red > 150 && green < 110 && blue < 110).toBe(false);
    }
  });
});

describe('the confetti burst', () => {
  it('fires exactly once per call — a single burst cannot strobe', async () => {
    stubReducedMotion(false);

    fireConfettiBurst({ intensity: 'standard' });

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({
      particleCount: CELEBRATION_PRESETS.standard.particleCount,
      ticks: CELEBRATION_PRESETS.standard.ticks,
      disableForReducedMotion: true,
    });
  });

  it('fires nothing when the viewer asked for reduced motion', async () => {
    stubReducedMotion(true);

    fireConfettiBurst({ intensity: 'big' });

    // Give any (wrongly) pending dynamic import a chance to resolve before
    // asserting the negative.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(confettiMock).not.toHaveBeenCalled();
  });

  it('defaults to the gentlest preset — the everyday tap is the quiet one', async () => {
    stubReducedMotion(false);

    fireConfettiBurst();

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({
      particleCount: CELEBRATION_PRESETS.gentle.particleCount,
    });
  });

  it('celebrates at the origin it was given', async () => {
    stubReducedMotion(false);

    fireConfettiBurst({ origin: { x: 0.25, y: 0.75 } });

    await vi.waitFor(() => expect(confettiMock).toHaveBeenCalledTimes(1));
    expect(confettiMock.mock.calls[0][0]).toMatchObject({ origin: { x: 0.25, y: 0.75 } });
  });
});

describe('the star pop', () => {
  it('renders the amount as a positive, never a delta', () => {
    stubReducedMotion(false);
    render(<StarPop amount={2} label="2 stars earned" />);

    expect(screen.getByLabelText('2 stars earned')).toHaveTextContent('+2');
  });

  it('renders nothing at all when there is no star to show', () => {
    stubReducedMotion(false);
    const { container } = render(<StarPop amount={0} label="no stars" />);
    expect(container.querySelector('[data-slot="star-pop"]')).toBeNull();
  });

  it('renders unsettled on the very first paint — even under reduced motion, so hydration never mismatches', () => {
    // `matchMedia` is a client-only read; the initial render (server and
    // first client paint alike) cannot know about reduced motion yet; it is
    // applied in the effect that runs right after, not baked into the first
    // render's markup.
    stubReducedMotion(true);
    render(<StarPop amount={1} label="1 star earned" />);

    expect(screen.getByLabelText('1 star earned')).toHaveAttribute('data-settled', 'false');
  });

  it('settles immediately after mount under reduced motion — no scale animation plays', async () => {
    stubReducedMotion(true);
    render(<StarPop amount={1} label="1 star earned" />);

    await vi.waitFor(() =>
      expect(screen.getByLabelText('1 star earned')).toHaveAttribute('data-settled', 'true')
    );
  });
});
