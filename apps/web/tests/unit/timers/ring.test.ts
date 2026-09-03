import { describe, expect, it } from 'vitest';
import { ringDashOffset } from '@/modules/timers/ui/timer-ring';

/**
 * `TimerRing`'s one piece of arithmetic (M-T2): the SVG
 * `strokeDashoffset` that draws the fullscreen hub timer's progress ring.
 *
 * The ring *fills* as the countdown elapses — same reading as
 * `TimerTile`'s `ProgressBar` (`value={Math.round(ratio * 100)}`), not a
 * depletion. `strokeDasharray` is the full circumference; the offset hides
 * however much of that has *not* elapsed yet, so at `ratio: 0` the whole
 * stroke is hidden (`offset === circumference`) and at `ratio: 1` none of it
 * is (`offset === 0`).
 */
describe('ringDashOffset', () => {
  const circumference = 2 * Math.PI * 140;

  it('hides the whole stroke at the start (ratio 0)', () => {
    expect(ringDashOffset(0, circumference)).toBeCloseTo(circumference, 5);
  });

  it('shows the whole stroke once elapsed (ratio 1)', () => {
    expect(ringDashOffset(1, circumference)).toBeCloseTo(0, 5);
  });

  it('is exactly half the circumference at the midpoint', () => {
    expect(ringDashOffset(0.5, circumference)).toBeCloseTo(circumference / 2, 5);
  });

  it('is linear in ratio', () => {
    const quarter = ringDashOffset(0.25, circumference);
    const threeQuarters = ringDashOffset(0.75, circumference);
    expect(quarter + threeQuarters).toBeCloseTo(circumference, 5);
  });

  it('clamps a ratio below 0 to a fully hidden stroke', () => {
    expect(ringDashOffset(-0.5, circumference)).toBeCloseTo(circumference, 5);
  });

  it('clamps a ratio above 1 to a fully shown stroke', () => {
    expect(ringDashOffset(1.5, circumference)).toBeCloseTo(0, 5);
  });

  it('scales with the circumference it is given', () => {
    expect(ringDashOffset(0.5, 100)).toBeCloseTo(50, 5);
    expect(ringDashOffset(0.5, 10)).toBeCloseTo(5, 5);
  });
});
