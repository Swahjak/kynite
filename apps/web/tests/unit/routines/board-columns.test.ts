import { describe, expect, it } from 'vitest';
import {
  bandsOf,
  columnProgress,
  firstOpenRoutineId,
  starsEarnedIn,
  visibleBands,
} from '@/modules/routines/domain/board-columns';
import type { RoutineState, TimeSection } from '@/modules/routines/domain/occurrence';

/**
 * The column arithmetic behind the family-wide "Actieve routines" page
 * (`domain/board-columns.ts`, M3 of the 2026-09-14 plan).
 *
 * Three questions, each of which has a wrong answer that would be visible on a
 * wall: a band that counts the wrong steps, a column head that disagrees with
 * the cards under it, and a card that opens because it happens to be first
 * rather than because it is the one a child should be doing.
 */

type Row = {
  id: string;
  section: TimeSection;
  doneCount: number;
  total: number;
  complete: boolean;
  state: RoutineState;
  starsPerCompletion: number;
};

const row = (id: string, overrides: Partial<Row> = {}): Row => ({
  id,
  section: 'morning',
  doneCount: 0,
  total: 3,
  complete: false,
  state: 'due',
  starsPerCompletion: 1,
  ...overrides,
});

describe('bandsOf', () => {
  it('returns every daypart in day order, empty ones included', () => {
    const bands = bandsOf([row('a', { section: 'evening' })]);

    expect(bands.map((band) => band.section)).toEqual(['morning', 'afternoon', 'evening']);
    expect(bands[0]?.routines).toEqual([]);
    expect(bands[2]?.routines.map((entry) => entry.id)).toEqual(['a']);
  });

  it('counts steps, not routines', () => {
    const bands = bandsOf([
      row('a', { section: 'morning', total: 6, doneCount: 2 }),
      row('b', { section: 'morning', total: 2, doneCount: 2, complete: true }),
    ]);

    expect(bands[0]).toMatchObject({ doneCount: 4, total: 8, ratio: 0.5 });
  });

  it('gives an empty band a zero ratio rather than a full one', () => {
    expect(bandsOf([])[0]).toMatchObject({ doneCount: 0, total: 0, ratio: 0 });
  });
});

describe('visibleBands', () => {
  it('drops the dayparts a member has nothing in', () => {
    const bands = visibleBands([
      row('a', { section: 'morning' }),
      row('b', { section: 'evening' }),
    ]);

    expect(bands.map((band) => band.section)).toEqual(['morning', 'evening']);
  });

  it('drops every band when the member has nothing today', () => {
    expect(visibleBands([])).toEqual([]);
  });
});

describe('columnProgress', () => {
  it('sums steps across bands and rounds the percentage', () => {
    expect(
      columnProgress([
        row('a', { total: 6, doneCount: 2 }),
        row('b', { section: 'evening', total: 5, doneCount: 1 }),
      ])
    ).toEqual({ doneSteps: 3, totalSteps: 11, percent: 27, complete: false });
  });

  it('is complete only when there was something to finish', () => {
    expect(columnProgress([]).complete).toBe(false);
    expect(columnProgress([row('a', { total: 2, doneCount: 2 })]).complete).toBe(true);
  });
});

describe('firstOpenRoutineId', () => {
  it('opens the first live unfinished routine', () => {
    const id = firstOpenRoutineId([
      row('done', { complete: true }),
      row('later', { state: 'upcoming' }),
      row('now', { state: 'due' }),
      row('also-now', { state: 'grace' }),
    ]);

    expect(id).toBe('now');
  });

  it('falls back to the first unfinished routine when nothing is live yet', () => {
    const id = firstOpenRoutineId([
      row('done', { complete: true }),
      row('later', { state: 'upcoming' }),
      row('even-later', { state: 'upcoming' }),
    ]);

    expect(id).toBe('later');
  });

  it('opens nothing once every routine is finished', () => {
    expect(firstOpenRoutineId([row('a', { complete: true })])).toBeNull();
    expect(firstOpenRoutineId([])).toBeNull();
  });
});

describe('starsEarnedIn', () => {
  it('pays per completed step, never per routine', () => {
    expect(
      starsEarnedIn([
        { doneCount: 2, starsPerCompletion: 3 },
        { doneCount: 5, starsPerCompletion: 1 },
      ])
    ).toBe(11);
  });

  it('pays nothing for a graduated routine', () => {
    expect(starsEarnedIn([{ doneCount: 4, starsPerCompletion: 0 }])).toBe(0);
  });
});
