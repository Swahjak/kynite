import { describe, expect, it } from 'vitest';

import { fromWall } from '@/modules/calendar/domain/zone';

const AMSTERDAM = 'Europe/Amsterdam';

/**
 * `fromWall`'s two irregular DST cases (docs comment in `domain/zone.ts`).
 * Amsterdam in 2026: spring-forward on 29 March (02:00 → 03:00), autumn-back
 * on 25 October (03:00 → 02:00, so 02:00–03:00 happens twice).
 */
describe('fromWall — DST', () => {
  it('spring-forward gap: maps the missing wall time just after the jump', () => {
    const instant = fromWall(
      { year: 2026, month: 3, day: 29, hour: 2, minute: 30, second: 0 },
      AMSTERDAM
    );

    // 02:30 never happens; Google's convention (and ours) is the post-jump
    // reading, i.e. the same instant as 03:30 CEST.
    expect(instant.toISOString()).toBe('2026-03-29T01:30:00.000Z');
  });

  it('autumn-back overlap: returns the first, pre-transition (CEST) occurrence', () => {
    const instant = fromWall(
      { year: 2026, month: 10, day: 25, hour: 2, minute: 30, second: 0 },
      AMSTERDAM
    );

    // 02:30 happens twice: once at CEST (UTC+2, 00:30 UTC) and once at CET
    // (UTC+1, 01:30 UTC). Google Calendar resolves an ambiguous local time to
    // the earlier, pre-transition instant — pinning the CEST reading here is
    // what N4 fixes: the old code silently returned the CET (later) one.
    expect(instant.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('autumn-back overlap: every half-hour reading in the overlap picks the earlier instant', () => {
    const cases: Array<[number, number, string]> = [
      [2, 0, '2026-10-25T00:00:00.000Z'],
      [2, 15, '2026-10-25T00:15:00.000Z'],
      [2, 45, '2026-10-25T00:45:00.000Z'],
      [2, 59, '2026-10-25T00:59:00.000Z'],
    ];

    for (const [hour, minute, expected] of cases) {
      const instant = fromWall(
        { year: 2026, month: 10, day: 25, hour, minute, second: 0 },
        AMSTERDAM
      );
      expect(instant.toISOString()).toBe(expected);
    }
  });

  it('autumn-back: unambiguous wall times either side of the overlap are unaffected', () => {
    const before = fromWall(
      { year: 2026, month: 10, day: 25, hour: 1, minute: 30, second: 0 },
      AMSTERDAM
    );
    // Still CEST: one hour before the overlap window opens.
    expect(before.toISOString()).toBe('2026-10-24T23:30:00.000Z');

    const after = fromWall(
      { year: 2026, month: 10, day: 25, hour: 3, minute: 30, second: 0 },
      AMSTERDAM
    );
    // Already CET: the overlap window has closed.
    expect(after.toISOString()).toBe('2026-10-25T02:30:00.000Z');
  });

  it('an ordinary day round-trips with no DST correction pass', () => {
    const instant = fromWall(
      { year: 2026, month: 6, day: 15, hour: 12, minute: 0, second: 0 },
      AMSTERDAM
    );

    expect(instant.toISOString()).toBe('2026-06-15T10:00:00.000Z');
  });
});
