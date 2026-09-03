import { describe, expect, it } from 'vitest';
import {
  UP_NEXT_LIMIT,
  currentBlock,
  currentBlocks,
  elapsedRatio,
  flowOf,
  minutesRemaining,
  minutesUntil,
  remainingReading,
  startsInReading,
  upcomingBlocks,
  type DayReference,
} from '@/modules/today/domain/flow';

/**
 * M19: the shape of a day behind `/today`'s NOW hero and Up Next grid.
 *
 * Written with the inputs the page actually hands it, not with tidy ones:
 *
 * - the household is in **Europe/Amsterdam** (UTC+2 in August), so a wall day
 *   runs from 22:00 UTC the evening before to 22:00 UTC the same evening. Every
 *   instant below is written as the UTC it is stored as, with the local time it
 *   reads as in a comment — because *that* mismatch is where the bugs were.
 * - an **all-day** row is persisted at UTC midnight (`00:00Z`), which on this
 *   family's clock is 02:00 in the middle of their morning. Comparing it to
 *   "now" as if it were a start time is what made "Vakantie" unreachable.
 * - a **browsed** day arrives as its own local midnight with an explicit kind,
 *   not as a `now` the flow has to reverse-engineer.
 */

const at = (iso: string) => new Date(iso);

function block(startIso: string, endIso: string, allDay = false) {
  return { startsAt: at(startIso), endsAt: at(endIso), allDay };
}

/** Friday 7 August 2026, as the family's clock reads it. */
const breakfast = block('2026-08-07T05:00:00.000Z', '2026-08-07T05:30:00.000Z'); // 07:00–07:30
const school = block('2026-08-07T06:30:00.000Z', '2026-08-07T13:00:00.000Z'); // 08:30–15:00
const swimming = block('2026-08-07T14:00:00.000Z', '2026-08-07T15:00:00.000Z'); // 16:00–17:00
const dinner = block('2026-08-07T16:00:00.000Z', '2026-08-07T17:00:00.000Z'); // 18:00–19:00
/** Stored at UTC midnight, as every all-day row is. */
const holiday = block('2026-08-07T00:00:00.000Z', '2026-08-08T00:00:00.000Z', true);
/** 22:00 → 02:00 the next morning: one block, two wall days. */
const nightShift = block('2026-08-07T20:00:00.000Z', '2026-08-08T00:00:00.000Z');

const day = [breakfast, school, swimming, dinner];

/** Real instants on that day, in UTC. */
const NOW_0710 = at('2026-08-07T05:10:00.000Z');
const NOW_0900 = at('2026-08-07T07:00:00.000Z');
const NOW_2330 = at('2026-08-07T21:30:00.000Z');

const today = (now: Date): DayReference => ({ kind: 'today', now });
/** Local midnight of a browsed day — 22:00 UTC the evening before. */
const browsed = (kind: 'past' | 'future', localMidnightUtc: string): DayReference => ({
  kind,
  now: at(localMidnightUtc),
});

describe('currentBlock', () => {
  it('finds the timed block the instant falls inside', () => {
    expect(currentBlock(day, NOW_0710)).toBe(breakfast);
  });

  it('is half-open at the end, so a handover minute belongs to one block only', () => {
    // 07:30 local sharp: breakfast has ended, school has not begun.
    expect(currentBlock(day, at('2026-08-07T05:30:00.000Z'))).toBeNull();
    // 08:30 local sharp: school has begun.
    expect(currentBlock(day, at('2026-08-07T06:30:00.000Z'))).toBe(school);
  });

  it('prefers the block finishing soonest when two overlap', () => {
    // Inside both "school" (until 15:00) and a 10:00–10:30 dentist visit. The
    // countdown on the card has to be true of the thing on the card.
    const dentist = block('2026-08-07T08:00:00.000Z', '2026-08-07T08:30:00.000Z');
    expect(currentBlock([school, dentist], at('2026-08-07T08:15:00.000Z'))).toBe(dentist);
  });

  it('stays live across midnight, because a block is an interval and not a day', () => {
    expect(currentBlock([nightShift], NOW_2330)).toBe(nightShift);
    // 01:00 local on the 8th — still the same shift.
    expect(currentBlock([nightShift], at('2026-08-07T23:00:00.000Z'))).toBe(nightShift);
    expect(minutesRemaining(nightShift, NOW_2330)).toBe(150);
  });

  it('never puts an all-day block in the hero', () => {
    // "Vakantie" is true all day and therefore says nothing about this minute —
    // a progress ring 40% through it would be meaningless.
    expect(currentBlock([holiday], NOW_0900)).toBeNull();
  });

  it('is null when nothing is live', () => {
    expect(currentBlock(day, at('2026-08-07T13:30:00.000Z'))).toBeNull();
    expect(currentBlock([], NOW_0900)).toBeNull();
  });
});

describe('currentBlocks', () => {
  it('returns the single live block as a one-element array', () => {
    expect(currentBlocks(day, NOW_0710)).toEqual([breakfast]);
  });

  it('returns every overlapping block, soonest-ending first', () => {
    // Inside "school" (until 15:00) and a 10:00–10:30 dentist visit — the same
    // overlap `currentBlock` picks the dentist out of, but here both come back.
    const dentist = block('2026-08-07T08:00:00.000Z', '2026-08-07T08:30:00.000Z');
    expect(currentBlocks([school, dentist], at('2026-08-07T08:15:00.000Z'))).toEqual([
      dentist,
      school,
    ]);
  });

  it('is an empty array when nothing is live', () => {
    expect(currentBlocks(day, at('2026-08-07T13:30:00.000Z'))).toEqual([]);
    expect(currentBlocks([], NOW_0900)).toEqual([]);
  });

  it('never includes an all-day block', () => {
    expect(currentBlocks([holiday], NOW_0900)).toEqual([]);
  });

  it("its first element is always currentBlock's answer", () => {
    const dentist = block('2026-08-07T08:00:00.000Z', '2026-08-07T08:30:00.000Z');
    const now = at('2026-08-07T08:15:00.000Z');
    expect(currentBlocks([school, dentist], now)[0]).toBe(currentBlock([school, dentist], now));
  });
});

describe('upcomingBlocks', () => {
  it('keeps only what has not started, earliest first', () => {
    expect(upcomingBlocks(day, NOW_0710)).toEqual([school, swimming, dinner]);
  });

  /**
   * The regression F27 was about. At 09:00 local the holiday's stored
   * `startsAt` (00:00Z) is two hours in the past, so a `startsAt > now` filter
   * drops it — on the one day it is true. Membership of the wall day is what
   * makes an all-day block current, and the caller has already established it.
   */
  it('keeps an all-day block even though its stored start is behind "now"', () => {
    expect(upcomingBlocks([holiday, ...day], NOW_0900)).toContain(holiday);
  });

  it('puts all-day blocks after every timed one, whatever they are stored as', () => {
    expect(upcomingBlocks([holiday, swimming, dinner], NOW_0900)).toEqual([
      swimming,
      dinner,
      holiday,
    ]);
  });

  it('orders two blocks that start at the same instant by the one ending first', () => {
    const long = block('2026-08-07T14:00:00.000Z', '2026-08-07T16:00:00.000Z');
    const short = block('2026-08-07T14:00:00.000Z', '2026-08-07T14:30:00.000Z');

    expect(upcomingBlocks([long, short], NOW_0900)).toEqual([short, long]);
  });
});

describe('flowOf — today', () => {
  it('puts the live block in the hero and everything after it in the grid', () => {
    const flow = flowOf(day, today(NOW_0710));

    expect(flow.hero).toBe(breakfast);
    expect(flow.live).toBe(true);
    expect(flow.mode).toBe('live');
    expect(flow.liveBlocks).toEqual([breakfast]);
    expect(flow.upNext).toEqual([school, swimming, dinner]);
  });

  it('lists every overlapping block in liveBlocks, hero first', () => {
    const dentist = block('2026-08-07T06:45:00.000Z', '2026-08-07T07:15:00.000Z'); // 08:45–09:15
    const flow = flowOf([...day, dentist], today(at('2026-08-07T07:00:00.000Z'))); // 09:00 local

    expect(flow.hero).toBe(dentist);
    expect(flow.live).toBe(true);
    expect(flow.liveBlocks).toEqual([dentist, school]);
    // Neither overlapping block repeats in the grid — both are already the hero
    // or a sibling of it, and `upcomingBlocks` excludes what has already
    // started anyway.
    expect(flow.upNext).toEqual([swimming, dinner]);
  });

  it('falls back to the next block when nothing is live, and never repeats it', () => {
    const flow = flowOf(day, today(at('2026-08-07T13:30:00.000Z'))); // 15:30 local

    expect(flow.hero).toBe(swimming);
    expect(flow.live).toBe(false);
    expect(flow.mode).toBe('next');
    expect(flow.liveBlocks).toEqual([]);
    expect(flow.upNext).toEqual([dinner]);
  });

  it('still offers an all-day block once the timed day is over', () => {
    const flow = flowOf([holiday, ...day], today(at('2026-08-07T17:30:00.000Z'))); // 19:30 local

    expect(flow.hero).toBe(holiday);
    expect(flow.live).toBe(false);
    expect(flow.mode).toBe('next');
    expect(flow.upNext).toEqual([]);
  });

  it('keeps a block that runs past midnight as the live hero', () => {
    const flow = flowOf([...day, nightShift], today(NOW_2330));

    expect(flow.hero).toBe(nightShift);
    expect(flow.live).toBe(true);
    expect(flow.mode).toBe('live');
    expect(flow.liveBlocks).toEqual([nightShift]);
  });

  it('is clear once nothing is left', () => {
    const flow = flowOf(day, today(at('2026-08-07T21:00:00.000Z'))); // 23:00 local

    expect(flow.hero).toBeNull();
    expect(flow.live).toBe(false);
    expect(flow.mode).toBe('clear');
    expect(flow.upNext).toEqual([]);
  });

  it('is clear on a day with no blocks at all', () => {
    const flow = flowOf([], today(NOW_0900));

    expect(flow).toEqual({
      hero: null,
      live: false,
      mode: 'clear',
      liveBlocks: [],
      upNext: [],
    });
  });

  it('caps the grid at the limit it is given', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      block(
        `2026-08-07T${String(index + 7).padStart(2, '0')}:00:00.000Z`,
        `2026-08-07T${String(index + 7).padStart(2, '0')}:30:00.000Z`
      )
    );

    expect(flowOf(many, today(at('2026-08-07T04:00:00.000Z'))).upNext).toHaveLength(UP_NEXT_LIMIT);
    expect(flowOf(many, today(at('2026-08-07T04:00:00.000Z')), 2).upNext).toHaveLength(2);
  });
});

describe('flowOf — a browsed day', () => {
  /**
   * F25/F26. A browsed day is not "a today whose morning has not happened yet".
   * Tomorrow is a preview — the whole day, stated, with no live claim and no
   * countdown — and yesterday is a record, which the old code rendered as
   * "nothing else planned" because every block was behind the reference.
   */
  it('previews a future day in full, with nothing live', () => {
    // Saturday 8 August, local midnight.
    const flow = flowOf(day, browsed('future', '2026-08-07T22:00:00.000Z'));

    expect(flow.hero).toBe(breakfast);
    expect(flow.live).toBe(false);
    expect(flow.mode).toBe('preview');
    expect(flow.liveBlocks).toEqual([]);
    expect(flow.upNext).toEqual([school, swimming, dinner]);
  });

  it('presents a past day as a record rather than an empty one', () => {
    // Thursday 6 August, local midnight — every block below is behind it.
    const flow = flowOf(day, browsed('past', '2026-08-05T22:00:00.000Z'));

    expect(flow.hero).toBe(breakfast);
    expect(flow.live).toBe(false);
    expect(flow.mode).toBe('past');
    expect(flow.liveBlocks).toEqual([]);
    expect(flow.upNext).toEqual([school, swimming, dinner]);
  });

  it('shows an all-day block on a browsed day too, sorted after the timed ones', () => {
    const flow = flowOf([holiday, swimming], browsed('future', '2026-08-07T22:00:00.000Z'));

    expect(flow.hero).toBe(swimming);
    expect(flow.upNext).toEqual([holiday]);
  });

  it('is clear on a browsed day that held nothing', () => {
    expect(flowOf([], browsed('past', '2026-08-05T22:00:00.000Z')).mode).toBe('clear');
    expect(flowOf([], browsed('future', '2026-08-07T22:00:00.000Z')).mode).toBe('clear');
  });
});

describe('elapsedRatio', () => {
  it('measures how far through a block the instant is', () => {
    expect(elapsedRatio(breakfast, at('2026-08-07T05:00:00.000Z'))).toBe(0);
    expect(elapsedRatio(breakfast, at('2026-08-07T05:15:00.000Z'))).toBe(0.5);
    expect(elapsedRatio(breakfast, at('2026-08-07T05:30:00.000Z'))).toBe(1);
  });

  it('clamps outside the block rather than sweeping backwards or past full', () => {
    expect(elapsedRatio(breakfast, at('2026-08-07T04:00:00.000Z'))).toBe(0);
    expect(elapsedRatio(breakfast, at('2026-08-07T07:00:00.000Z'))).toBe(1);
  });

  it('is zero for an all-day or zero-length block instead of dividing by nothing', () => {
    expect(elapsedRatio(holiday, NOW_0900)).toBe(0);
    expect(
      elapsedRatio(
        block('2026-08-07T05:00:00.000Z', '2026-08-07T05:00:00.000Z'),
        at('2026-08-07T05:00:00.000Z')
      )
    ).toBe(0);
  });
});

describe('minutesRemaining / minutesUntil', () => {
  it('rounds up, so the last minute of a block never reads as zero', () => {
    expect(minutesRemaining(breakfast, at('2026-08-07T05:29:30.000Z'))).toBe(1);
    expect(minutesUntil(school, at('2026-08-07T06:29:30.000Z'))).toBe(1);
  });

  it('never goes negative', () => {
    expect(minutesRemaining(breakfast, NOW_0900)).toBe(0);
    expect(minutesUntil(breakfast, NOW_0900)).toBe(0);
  });
});

describe('remainingReading', () => {
  // The NU strip's "nog …" countdown: minutes under an hour, hours past it —
  // an 8-hour school day used to read "nog 480 minuten".
  const workday = block('2026-08-07T07:00:00.000Z', '2026-08-07T15:00:00.000Z');

  it('reads as minutes under the 60-minute mark', () => {
    expect(remainingReading(breakfast, at('2026-08-07T05:29:30.000Z'))).toEqual({
      kind: 'minutes',
      minutes: 1,
    });
    expect(remainingReading(school, at('2026-08-07T12:40:00.000Z'))).toEqual({
      kind: 'minutes',
      minutes: 20,
    });
  });

  it('reads as a whole hour once the remainder is exactly zero', () => {
    // school ends at 13:00Z — exactly 60 minutes out from 12:00Z.
    expect(remainingReading(school, at('2026-08-07T12:00:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 1,
      minutes: 0,
    });
    // The reported bug: an 8-hour workday, measured from its start.
    expect(remainingReading(workday, at('2026-08-07T07:00:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 8,
      minutes: 0,
    });
  });

  it('splits into hours and a minute remainder otherwise', () => {
    // school starts 06:30Z, ends 13:00Z — 390 minutes at its own start.
    expect(remainingReading(school, at('2026-08-07T06:30:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 6,
      minutes: 30,
    });
    expect(remainingReading(school, at('2026-08-07T11:45:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 1,
      minutes: 15,
    });
  });
});

describe('startsInReading', () => {
  // Same thresholds as the routines board's own upcoming chip
  // (`countdownFor` in `modules/routines/ui/routine-board.tsx`): a duration
  // close in, and a clock time once "over 6 uur" stops being a number anyone
  // converts.
  it('reads as minutes at and under the 90-minute mark', () => {
    expect(startsInReading(dinner, at('2026-08-07T14:30:00.000Z'))).toEqual({
      kind: 'minutes',
      minutes: 90,
    });
    expect(startsInReading(dinner, at('2026-08-07T15:50:00.000Z'))).toEqual({
      kind: 'minutes',
      minutes: 10,
    });
  });

  it('reads as rounded hours between 90 minutes and 6 hours out', () => {
    // dinner starts 18:00Z16:00 — 91 minutes out from 14:29Z.
    expect(startsInReading(dinner, at('2026-08-07T14:29:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 2,
    });
    // Exactly 6 hours (360 minutes) still reads as hours, not the clock.
    expect(startsInReading(dinner, at('2026-08-07T10:00:00.000Z'))).toEqual({
      kind: 'hours',
      hours: 6,
    });
  });

  it('falls back to the clock time past the six-hour mark — never "over 396 min"', () => {
    // 396 minutes (6.6 hours) out — the reported bug.
    expect(startsInReading(dinner, at('2026-08-07T09:24:00.000Z'))).toEqual({ kind: 'clock' });
  });
});
