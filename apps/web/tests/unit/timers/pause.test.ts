import { describe, expect, it } from 'vitest';
import {
  elapsedMs,
  endsAtMs,
  isOnBoard,
  isWarningDue,
  phaseOf,
  progressRatio,
  remainingSeconds,
  type TimerClock,
} from '@/modules/timers/domain/countdown';

/**
 * Pause/resume arithmetic (M-T1).
 *
 * The whole feature is one derivation: `elapsed = (pausedAt ?? now) -
 * startedAt - pausedSeconds`. `pausedAt` freezes the clock at the instant it
 * was set — the remaining time must read identically no matter how much later
 * it is asked, which is the property every test here actually checks (the
 * same "reads the same at the same instant" discipline `countdown.test.ts`
 * already holds for the un-paused clock).
 */

const START = new Date('2026-08-06T07:30:00.000Z');
const startMs = START.getTime();

function timer(overrides: Partial<TimerClock> = {}): TimerClock {
  return { startedAt: START, durationSeconds: 300, stoppedAt: null, ...overrides };
}

describe('remaining time freezes while paused', () => {
  it('stops moving the instant pausedAt is set, however much later it is read', () => {
    const paused = timer({ pausedAt: new Date(startMs + 60_000) });

    // 100s left at the moment of pausing.
    expect(remainingSeconds(paused, startMs + 60_000)).toBe(240);
    // A minute later on the wall clock, or an hour — still 240.
    expect(remainingSeconds(paused, startMs + 120_000)).toBe(240);
    expect(remainingSeconds(paused, startMs + 3_600_000)).toBe(240);
  });

  it('does not move the progress ring either', () => {
    const paused = timer({ pausedAt: new Date(startMs + 150_000) });

    expect(progressRatio(paused, startMs + 150_000)).toBeCloseTo(0.5, 5);
    expect(progressRatio(paused, startMs + 999_000)).toBeCloseTo(0.5, 5);
  });

  it('reports the paused phase, not running or overrun', () => {
    const paused = timer({ pausedAt: new Date(startMs + 60_000) });
    expect(phaseOf(paused, startMs + 60_000)).toBe('paused');
    expect(phaseOf(paused, startMs + 3_600_000)).toBe('paused');
  });

  it('a stopped timer stays stopped even if pausedAt is somehow also set', () => {
    // stoppedAt is terminal; it wins regardless of what else is on the row.
    const both = timer({
      pausedAt: new Date(startMs + 60_000),
      stoppedAt: new Date(startMs + 60_000),
    });
    expect(phaseOf(both, startMs + 3_600_000)).toBe('stopped');
  });

  it('stays on the board while paused, unbounded by the overrun window', () => {
    const paused = timer({ pausedAt: new Date(startMs + 60_000) });
    // Paused for a very long time — still on the board, unlike an ignored
    // overrun timer.
    expect(isOnBoard(paused, startMs + 100 * 60 * 60 * 1000)).toBe(true);
  });

  it('never warns or chimes while paused, even past the lead time', () => {
    const paused = {
      ...timer({ durationSeconds: 900, pausedAt: new Date(startMs + 610_000) }),
      warningLeadSeconds: 300,
    };
    // 290s remain at the pause instant — inside the warning window — but the
    // board must not announce a transition nobody can act on.
    expect(isWarningDue(paused, startMs + 610_000)).toBe(false);
    expect(isWarningDue(paused, startMs + 3_600_000)).toBe(false);
  });
});

describe('resuming folds the pause into pausedSeconds', () => {
  it('resumes ticking from where it left off once pausedSeconds accounts for the gap', () => {
    // Paused at +60s, resumed at +660s (10 minutes later): 600s of pause time
    // is what `resumeTimerAction` commits to `pausedSeconds` in SQL. The
    // resumed timer is represented here the way a fresh read of the row would
    // be: pausedAt cleared, pausedSeconds carrying the committed gap.
    const resumed = timer({ pausedSeconds: 600 });

    // Immediately after resuming (nowMs = +660s), the countdown should read
    // exactly what it did the instant before the pause (+60s): 240s left.
    expect(remainingSeconds(resumed, startMs + 660_000)).toBe(240);
    // And it keeps counting down normally from there.
    expect(remainingSeconds(resumed, startMs + 661_000)).toBe(239);
  });

  it('pushes the end time out by exactly the accumulated pause', () => {
    expect(endsAtMs(timer())).toBe(startMs + 300_000);
    expect(endsAtMs(timer({ pausedSeconds: 600 }))).toBe(startMs + 900_000);
  });

  it('accounts for more than one pause, back to back', () => {
    // Two 30s pauses, both already committed: the countdown needs 360s of
    // wall-clock time (300s running + 60s paused) to reach zero, not 300.
    const twicePaused = timer({ pausedSeconds: 60 });
    expect(remainingSeconds(twicePaused, startMs + 359_000)).toBe(1);
    expect(remainingSeconds(twicePaused, startMs + 360_000)).toBe(0);
  });

  it('elapsedMs excludes every second spent paused', () => {
    expect(elapsedMs(timer({ pausedSeconds: 600 }), startMs + 660_000)).toBe(60_000);
  });
});

describe('backward compatibility: fields are optional', () => {
  it('treats an object with no pause fields exactly as before', () => {
    const plain = { startedAt: START, durationSeconds: 300, stoppedAt: null };
    expect(remainingSeconds(plain, startMs + 60_000)).toBe(240);
    expect(phaseOf(plain, startMs + 60_000)).toBe('running');
    expect(endsAtMs(plain)).toBe(startMs + 300_000);
  });
});
