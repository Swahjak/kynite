import { describe, expect, it } from 'vitest';
import { hasRolledOver } from '@/modules/today/domain/rollover';

/**
 * `hasRolledOver` is the whole fix for the "vandaag" heading (and its data
 * window) freezing on yesterday: `TodayClock` calls it on every tick and asks
 * the server to render again the moment it returns `true`. So the case that
 * matters is exactly the one the household's own clock hits daily — midnight,
 * in the household's *local* zone, not UTC.
 */

const AMSTERDAM = 'Europe/Amsterdam'; // UTC+2 in August (DST)
const KIRITIMATI = 'Pacific/Kiritimati'; // UTC+14, no DST — furthest-ahead zone

describe('hasRolledOver', () => {
  it('is false while the instant still reads as the seeded day', () => {
    // 23:59 local (Amsterdam, UTC+2): still 7 Aug on the wall.
    const stillTheSameDay = new Date('2026-08-07T21:59:00.000Z');
    expect(hasRolledOver('2026-08-07', stillTheSameDay, AMSTERDAM)).toBe(false);
  });

  it('is true the instant local midnight passes', () => {
    // 00:00 local (Amsterdam, UTC+2) is 22:00 UTC the evening before.
    const justAfterMidnight = new Date('2026-08-07T22:00:00.000Z');
    expect(hasRolledOver('2026-08-07', justAfterMidnight, AMSTERDAM)).toBe(true);
  });

  it('reads the household zone, not the server/UTC one — the M20 bug', () => {
    // 2026-08-13T23:30:00Z is still 13 Aug in UTC, but already 01:30 on 14
    // Aug on an Amsterdam wall clock (UTC+2) — exactly the "today says the
    // 13th while it's already the 14th locally" report this fix addresses.
    const halfPastOneLocalOnTheFourteenth = new Date('2026-08-13T23:30:00.000Z');
    expect(halfPastOneLocalOnTheFourteenth.getUTCDate()).toBe(13); // a server reading raw UTC would call this still the 13th
    expect(hasRolledOver('2026-08-13', halfPastOneLocalOnTheFourteenth, AMSTERDAM)).toBe(true);
  });

  it('holds off past 22:00 UTC in a zone that is still far ahead', () => {
    // Kiritimati (UTC+14) reads 2026-08-08T10:00 local at this UTC instant —
    // the day has not turned there yet, even though Amsterdam's already has.
    const instant = new Date('2026-08-07T20:00:00.000Z');
    expect(hasRolledOver('2026-08-08', instant, KIRITIMATI)).toBe(false);
  });

  it('is false, not merely falsy, once re-seeded with the new day key', () => {
    const justAfterMidnight = new Date('2026-08-07T22:05:00.000Z');
    expect(hasRolledOver('2026-08-08', justAfterMidnight, AMSTERDAM)).toBe(false);
  });
});
