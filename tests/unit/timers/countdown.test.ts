import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WARNING_LEAD_SECONDS,
  OVERRUN_VISIBLE_SECONDS,
  clockOffsetMs,
  endsAtMs,
  formatCountdown,
  isOnBoard,
  isWarningDue,
  minutesRemaining,
  nextTickDelayMs,
  overrunSeconds,
  phaseOf,
  progressRatio,
  remainingMs,
  remainingSeconds,
  serverNowFrom,
  toMillis,
} from '@/modules/timers/domain/countdown';

/**
 * The timer clock (M09).
 *
 * Three properties are worth more than the arithmetic: remaining time is a
 * *derivation* from the start (so a reload cannot lose it), running over is a
 * neutral state rather than an error, and the device's own clock never enters
 * the calculation of what is true — only of how much time has passed since the
 * last server echo.
 */

const START = new Date('2026-08-06T07:30:00.000Z');
const startMs = START.getTime();

function timer(overrides: Partial<Parameters<typeof phaseOf>[0]> = {}) {
  return { startedAt: START, durationSeconds: 300, stoppedAt: null, ...overrides };
}

describe('remaining time is derived, never stored', () => {
  it('counts down from the duration as the clock advances', () => {
    expect(remainingSeconds(timer(), startMs)).toBe(300);
    expect(remainingSeconds(timer(), startMs + 60_000)).toBe(240);
    expect(remainingSeconds(timer(), startMs + 299_000)).toBe(1);
    expect(remainingSeconds(timer(), startMs + 300_000)).toBe(0);
  });

  it('reads the same at the same instant no matter when it is asked', () => {
    // The whole hub-reload guarantee in one assertion: two independent readers
    // at the same instant agree, because neither is holding state.
    const mid = startMs + 123_456;
    expect(remainingSeconds(timer(), mid)).toBe(remainingSeconds(timer(), mid));
    expect(remainingMs(timer(), mid)).toBe(300_000 - 123_456);
  });

  it('rounds up, so the last second is shown for the whole of it', () => {
    // 0.4s left is still "1", the way a kitchen timer behaves — a rounded-down
    // clock would show 0 for the final half-second and look stuck.
    expect(remainingSeconds(timer(), startMs + 299_600)).toBe(1);
    expect(remainingSeconds(timer(), startMs + 300_001)).toBe(0);
  });

  it('accepts a start time in any transport shape', () => {
    const asIso = timer({ startedAt: START.toISOString() });
    const asEpoch = timer({ startedAt: startMs });

    expect(remainingSeconds(asIso, startMs + 60_000)).toBe(240);
    expect(remainingSeconds(asEpoch, startMs + 60_000)).toBe(240);
    expect(toMillis(START.toISOString())).toBe(startMs);
    expect(endsAtMs(timer())).toBe(startMs + 300_000);
  });

  it('never reports a negative remaining time', () => {
    expect(remainingSeconds(timer(), startMs + 10 * 60_000)).toBe(0);
  });
});

describe('overrun is a state, not a failure', () => {
  it('switches phase at zero and starts counting up', () => {
    expect(phaseOf(timer(), startMs + 299_999)).toBe('running');
    expect(phaseOf(timer(), startMs + 300_000)).toBe('overrun');
    expect(overrunSeconds(timer(), startMs + 300_000)).toBe(0);
    expect(overrunSeconds(timer(), startMs + 330_500)).toBe(30);
  });

  it('reports zero overrun while it is still running', () => {
    expect(overrunSeconds(timer(), startMs + 10_000)).toBe(0);
  });

  it('is stopped the moment someone stops it, whatever the clock says', () => {
    const stopped = timer({ stoppedAt: new Date(startMs + 42_000) });

    expect(phaseOf(stopped, startMs + 42_000)).toBe('stopped');
    // Even past its own duration: stopping is the terminal state.
    expect(phaseOf(stopped, startMs + 999_000)).toBe('stopped');
  });

  it('stays on the board while overrunning, then quietly leaves it', () => {
    expect(isOnBoard(timer(), startMs + 60_000)).toBe(true);
    expect(isOnBoard(timer(), startMs + 300_000)).toBe(true);
    expect(isOnBoard(timer(), startMs + 300_000 + (OVERRUN_VISIBLE_SECONDS - 1) * 1000)).toBe(true);
    expect(isOnBoard(timer(), startMs + 300_000 + OVERRUN_VISIBLE_SECONDS * 1000)).toBe(false);
    // A stopped timer is never on the board, however recently it was stopped.
    expect(isOnBoard(timer({ stoppedAt: new Date(startMs + 1000) }), startMs + 1000)).toBe(false);
  });

  it('holds the progress ring at full rather than overflowing it', () => {
    expect(progressRatio(timer(), startMs)).toBe(0);
    expect(progressRatio(timer(), startMs + 150_000)).toBeCloseTo(0.5, 5);
    expect(progressRatio(timer(), startMs + 600_000)).toBe(1);
    // A clock that jumped backwards must not produce a negative width.
    expect(progressRatio(timer(), startMs - 60_000)).toBe(0);
  });
});

describe('clock skew: the device clock is never the authority', () => {
  it('measures the offset between the two clocks', () => {
    // A wall tablet two hours fast.
    const clientNow = startMs + 2 * 60 * 60 * 1000;
    expect(clockOffsetMs(startMs, clientNow)).toBe(-2 * 60 * 60 * 1000);
  });

  it('renders the correct remaining time on a device whose clock is hours out', () => {
    const skewMs = 2 * 60 * 60 * 1000 + 37_000;

    // The server says "now" is 60s after the start; the device disagrees.
    const serverNow = startMs + 60_000;
    const clientNow = serverNow + skewMs;
    const offset = clockOffsetMs(serverNow, clientNow);

    // One second of real time passes on the device.
    const laterClient = clientNow + 1000;
    const derived = serverNowFrom(laterClient, offset);

    expect(derived).toBe(serverNow + 1000);
    expect(remainingSeconds(timer(), derived)).toBe(239);
    // Trusting the device clock directly would have been wildly wrong.
    expect(remainingSeconds(timer(), laterClient)).toBe(0);
  });

  it('follows a device clock that is corrected mid-countdown', () => {
    const serverNow = startMs + 60_000;

    const before = clockOffsetMs(serverNow, serverNow + 90_000);
    // NTP corrects the device; the next echo measures a new offset.
    const after = clockOffsetMs(serverNow + 2000, serverNow + 2000);

    expect(remainingSeconds(timer(), serverNowFrom(serverNow + 90_000, before))).toBe(240);
    expect(remainingSeconds(timer(), serverNowFrom(serverNow + 2000, after))).toBe(238);
  });

  it('aligns the tick to the whole second of server time', () => {
    expect(nextTickDelayMs(startMs)).toBe(1000);
    expect(nextTickDelayMs(startMs + 250)).toBe(750);
    expect(nextTickDelayMs(startMs + 999)).toBe(1);
    // Never zero — a zero delay would spin the timeout loop.
    for (const offset of [0, 1, 499, 500, 999, 1000, 123_456]) {
      const delay = nextTickDelayMs(startMs + offset);
      expect(delay).toBeGreaterThan(0);
      expect(delay).toBeLessThanOrEqual(1000);
    }
  });
});

describe('what the digits say', () => {
  it('formats minutes and seconds, padded', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(90)).toBe('1:30');
    expect(formatCountdown(600)).toBe('10:00');
  });

  it('grows an hours field rather than showing 90 minutes', () => {
    expect(formatCountdown(3600)).toBe('1:00:00');
    expect(formatCountdown(3661)).toBe('1:01:01');
  });

  it('never renders a negative clock', () => {
    expect(formatCountdown(-30)).toBe('0:00');
  });
});

describe('transition warnings', () => {
  const warned = { ...timer(), warningLeadSeconds: DEFAULT_WARNING_LEAD_SECONDS };

  it('fires exactly at the configured lead time and stays up until zero', () => {
    const withLead = { ...timer({ durationSeconds: 900 }), warningLeadSeconds: 300 };

    expect(isWarningDue(withLead, startMs + 599_000)).toBe(false);
    expect(isWarningDue(withLead, startMs + 600_000)).toBe(true);
    expect(isWarningDue(withLead, startMs + 899_000)).toBe(true);
  });

  it('does not warn once the time is up — the board has moved on', () => {
    expect(isWarningDue(warned, startMs + 300_000)).toBe(false);
  });

  it('does not warn for a stopped timer or one with no lead configured', () => {
    expect(isWarningDue({ ...warned, stoppedAt: new Date(startMs + 10) }, startMs + 20)).toBe(
      false
    );
    expect(isWarningDue({ ...timer(), warningLeadSeconds: null }, startMs + 299_000)).toBe(false);
  });

  it('counts the warning down in whole minutes and never says zero', () => {
    const withLead = { ...timer({ durationSeconds: 900 }), warningLeadSeconds: 300 };

    expect(minutesRemaining(withLead, startMs + 600_000)).toBe(5);
    expect(minutesRemaining(withLead, startMs + 660_000)).toBe(4);
    expect(minutesRemaining(withLead, startMs + 899_000)).toBe(1);
    // The final second is still "1 minute", never "0 minutes".
    expect(minutesRemaining(withLead, startMs + 899_900)).toBe(1);
  });
});
