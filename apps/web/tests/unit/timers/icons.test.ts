import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMER_ICON,
  TIMER_ICONS,
  isTimerIcon,
  timerIconOf,
} from '@/modules/timers/ui/tokens';

/**
 * The timer icon set (M-T1) — validation and the render-time fallback chain.
 * The picker that lets someone actually choose one is M-T2; this is the
 * closed set it will render from and the server already validates against
 * (`startTimerAction`'s `icon` field).
 */

describe('TIMER_ICONS', () => {
  it('always includes the default', () => {
    expect(TIMER_ICONS).toContain(DEFAULT_TIMER_ICON);
    expect(DEFAULT_TIMER_ICON).toBe('timer');
  });

  it('has no duplicate entries', () => {
    expect(new Set(TIMER_ICONS).size).toBe(TIMER_ICONS.length);
  });
});

describe('isTimerIcon', () => {
  it('accepts every name in the closed set', () => {
    for (const icon of TIMER_ICONS) {
      expect(isTimerIcon(icon)).toBe(true);
    }
  });

  it('rejects an unknown name', () => {
    expect(isTimerIcon('rocket_launch')).toBe(false);
    expect(isTimerIcon('')).toBe(false);
    // A routine-only icon that is not also a timer icon.
    expect(isTimerIcon('wb_sunny')).toBe(false);
  });
});

describe('timerIconOf', () => {
  it("prefers the timer's own icon when it is a valid timer icon", () => {
    expect(timerIconOf({ icon: 'sports_esports', routineIcon: 'wb_sunny' })).toBe('sports_esports');
  });

  it('falls back to the parent routine icon when the timer has none', () => {
    expect(timerIconOf({ icon: null, routineIcon: 'wb_sunny' })).toBe('wb_sunny');
  });

  it('falls back to the default when neither is set', () => {
    expect(timerIconOf({ icon: null, routineIcon: null })).toBe(DEFAULT_TIMER_ICON);
    expect(timerIconOf({ icon: null })).toBe(DEFAULT_TIMER_ICON);
  });

  it('defaults an unrecognised stored icon rather than rendering it blindly', () => {
    // A defensive case: the timer's own `icon` column is validated at write
    // time, but a value that predates a TIMER_ICONS change should still
    // degrade to the default rather than reach the font as an unknown name.
    expect(timerIconOf({ icon: 'not_a_real_icon', routineIcon: null })).toBe(DEFAULT_TIMER_ICON);
  });
});
