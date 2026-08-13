import { describe, expect, it } from 'vitest';

import {
  dayKeysOf,
  expandSeries,
  parseDateLine,
  rulesOf,
  type ExpandableSeries,
} from '@/modules/calendar/domain/expand';
import { occurrencesOf, parseRule } from '@/modules/calendar/domain/rrule';

/**
 * Recurrence expansion (M06). The custody patterns come straight from
 * docs/architecture.md §3 — they are the reason the recurrence model is stored
 * verbatim and expanded on read rather than materialised.
 */

const AMSTERDAM = 'Europe/Amsterdam';

function series(overrides: Partial<ExpandableSeries> = {}): ExpandableSeries {
  return {
    id: 'series-1',
    // Monday 2 March 2026, 08:30 Amsterdam.
    startsAt: new Date('2026-03-02T07:30:00.000Z'),
    endsAt: new Date('2026-03-02T08:30:00.000Z'),
    allDay: false,
    tz: AMSTERDAM,
    rrule: null,
    rdates: [],
    exdates: [],
    ...overrides,
  };
}

/** Occurrence starts as `YYYY-MM-DD HH:mm` in Amsterdam, for readable assertions. */
function localStarts(instants: { startsAt: Date }[]): string[] {
  return instants.map(({ startsAt }) =>
    new Intl.DateTimeFormat('sv-SE', {
      timeZone: AMSTERDAM,
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(startsAt)
  );
}

describe('expandSeries — non-recurring rows', () => {
  it('yields the row itself when it overlaps the window', () => {
    const occurrences = expandSeries(series(), {
      from: new Date('2026-03-02T00:00:00.000Z'),
      to: new Date('2026-03-03T00:00:00.000Z'),
    });

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0].isRecurringInstance).toBe(false);
    expect(occurrences[0].key).toBe('series-1');
  });

  it('yields nothing outside the window', () => {
    expect(
      expandSeries(series(), {
        from: new Date('2026-04-01T00:00:00.000Z'),
        to: new Date('2026-04-02T00:00:00.000Z'),
      })
    ).toEqual([]);
  });

  it('includes an event that started before the window but runs into it', () => {
    const overnight = series({
      startsAt: new Date('2026-03-01T21:00:00.000Z'),
      endsAt: new Date('2026-03-02T05:00:00.000Z'),
    });

    expect(
      expandSeries(overnight, {
        from: new Date('2026-03-02T00:00:00.000Z'),
        to: new Date('2026-03-03T00:00:00.000Z'),
      })
    ).toHaveLength(1);
  });
});

describe('custody patterns from docs/architecture.md §3', () => {
  it('alternating weeks — FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', () => {
    const occurrences = expandSeries(series({ rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO' }), {
      from: new Date('2026-03-01T00:00:00.000Z'),
      to: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(localStarts(occurrences)).toEqual([
      '2026-03-02 08:30',
      '2026-03-16 08:30',
      '2026-03-30 08:30',
      '2026-04-13 08:30',
      '2026-04-27 08:30',
    ]);
  });

  it('2-2-3 rotation — two RRULEs on one series', () => {
    // Parent A: Mon+Tue every week, plus alternating Fri-Sun weekends.
    const rotation = ['FREQ=WEEKLY;BYDAY=MO,TU', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=FR,SA,SU'].join(
      '\n'
    );

    const occurrences = expandSeries(series({ rrule: rotation }), {
      from: new Date('2026-03-01T00:00:00.000Z'),
      to: new Date('2026-03-22T00:00:00.000Z'),
    });

    expect(localStarts(occurrences)).toEqual([
      '2026-03-02 08:30', // Mon
      '2026-03-03 08:30', // Tue
      '2026-03-06 08:30', // Fri  (week 1 weekend)
      '2026-03-07 08:30', // Sat
      '2026-03-08 08:30', // Sun
      '2026-03-09 08:30', // Mon
      '2026-03-10 08:30', // Tue
      '2026-03-16 08:30', // Mon  (week 2 weekend skipped)
      '2026-03-17 08:30', // Tue
      '2026-03-20 08:30', // Fri  (week 3 weekend)
      '2026-03-21 08:30', // Sat
    ]);
  });

  it('every 1st and 3rd weekend — FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3', () => {
    const occurrences = expandSeries(
      series({
        // DTSTART on the first Friday so the series starts where the rule does.
        startsAt: new Date('2026-03-06T07:30:00.000Z'),
        endsAt: new Date('2026-03-06T08:30:00.000Z'),
        rrule: 'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3',
      }),
      {
        from: new Date('2026-03-01T00:00:00.000Z'),
        to: new Date('2026-06-01T00:00:00.000Z'),
      }
    );

    expect(localStarts(occurrences)).toEqual([
      '2026-03-06 08:30', // 1st Friday of March
      '2026-03-20 08:30', // 3rd Friday of March
      '2026-04-03 08:30',
      '2026-04-17 08:30',
      '2026-05-01 08:30',
      '2026-05-15 08:30',
    ]);
  });
});

describe('DST', () => {
  it('keeps the wall-clock time across the spring-forward boundary', () => {
    // Europe/Amsterdam springs forward on Sunday 29 March 2026.
    const occurrences = expandSeries(series({ rrule: 'FREQ=WEEKLY;BYDAY=MO' }), {
      from: new Date('2026-03-20T00:00:00.000Z'),
      to: new Date('2026-04-10T00:00:00.000Z'),
    });

    expect(localStarts(occurrences)).toEqual([
      '2026-03-23 08:30',
      '2026-03-30 08:30',
      '2026-04-06 08:30',
    ]);

    // The UTC instant shifts by an hour precisely because the wall time held.
    expect(occurrences[0].startsAt.toISOString()).toBe('2026-03-23T07:30:00.000Z');
    expect(occurrences[1].startsAt.toISOString()).toBe('2026-03-30T06:30:00.000Z');
  });
});

describe('EXDATE / RDATE', () => {
  it('removes an occurrence named by EXDATE (the single-instance-edit shape)', () => {
    const withException = series({
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      exdates: ['EXDATE;TZID=Europe/Amsterdam:20260309T083000'],
    });

    const occurrences = expandSeries(withException, {
      from: new Date('2026-03-01T00:00:00.000Z'),
      to: new Date('2026-03-24T00:00:00.000Z'),
    });

    expect(localStarts(occurrences)).toEqual([
      '2026-03-02 08:30',
      '2026-03-16 08:30',
      '2026-03-23 08:30',
    ]);
  });

  it('removes the slot an imported Google override replaces, which carries no EXDATE', () => {
    // Google never writes an EXDATE onto the master: the exception is a
    // separate instance resource, stored as a child row with the original slot
    // on it (`event.recurrence_original_start`). Without the subtraction the
    // parent generates 9 March *and* the child renders it — the duplicate.
    const imported = series({ rrule: 'FREQ=WEEKLY;BYDAY=MO' });
    const window = {
      from: new Date('2026-03-01T00:00:00.000Z'),
      to: new Date('2026-03-24T00:00:00.000Z'),
    };

    expect(localStarts(expandSeries(imported, window))).toContain('2026-03-09 08:30');

    const deduped = expandSeries(imported, {
      ...window,
      excludeStarts: [new Date('2026-03-09T07:30:00.000Z')],
    });

    expect(localStarts(deduped)).toEqual([
      '2026-03-02 08:30',
      '2026-03-16 08:30',
      '2026-03-23 08:30',
    ]);
  });

  it('honours a UTC EXDATE value as UTC, not as the series zone', () => {
    // 07:30Z *is* 08:30 Amsterdam — the same instant the rule generates.
    const occurrences = expandSeries(
      series({ rrule: 'FREQ=WEEKLY;BYDAY=MO', exdates: ['EXDATE:20260309T073000Z'] }),
      { from: new Date('2026-03-08T00:00:00.000Z'), to: new Date('2026-03-15T00:00:00.000Z') }
    );

    expect(occurrences).toEqual([]);
  });

  it('adds an off-pattern occurrence named by RDATE', () => {
    const occurrences = expandSeries(
      series({
        rrule: 'FREQ=WEEKLY;BYDAY=MO',
        rdates: ['RDATE;TZID=Europe/Amsterdam:20260304T083000'],
      }),
      { from: new Date('2026-03-01T00:00:00.000Z'), to: new Date('2026-03-10T00:00:00.000Z') }
    );

    expect(localStarts(occurrences)).toEqual([
      '2026-03-02 08:30',
      '2026-03-04 08:30',
      '2026-03-09 08:30',
    ]);
  });

  it('parses multi-value date lines', () => {
    const values = parseDateLine(
      'EXDATE;TZID=Europe/Amsterdam:20260302T083000,20260309T083000',
      AMSTERDAM
    );

    expect(values.map((value) => value.toISOString())).toEqual([
      '2026-03-02T07:30:00.000Z',
      '2026-03-09T07:30:00.000Z',
    ]);
  });

  it('falls back to the series zone when a TZID is unknown to the runtime', () => {
    const values = parseDateLine('EXDATE;TZID=Mars/Olympus_Mons:20260302T083000', AMSTERDAM);

    expect(values.map((value) => value.toISOString())).toEqual(['2026-03-02T07:30:00.000Z']);
  });
});

describe('COUNT and UNTIL', () => {
  it('counts from DTSTART, not from the window', () => {
    const all = series({ rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=3' });

    // The window opens after the first two occurrences; only the third is left.
    const occurrences = expandSeries(all, {
      from: new Date('2026-03-15T00:00:00.000Z'),
      to: new Date('2026-05-01T00:00:00.000Z'),
    });

    expect(localStarts(occurrences)).toEqual(['2026-03-16 08:30']);
  });

  it('stops at UNTIL, inclusive', () => {
    const occurrences = expandSeries(
      series({ rrule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260316T073000Z' }),
      { from: new Date('2026-03-01T00:00:00.000Z'), to: new Date('2026-05-01T00:00:00.000Z') }
    );

    expect(localStarts(occurrences)).toEqual([
      '2026-03-02 08:30',
      '2026-03-09 08:30',
      '2026-03-16 08:30',
    ]);
  });
});

describe('monthly edge cases', () => {
  it('skips short months rather than clamping a 31st series', () => {
    const occurrences = expandSeries(
      series({
        startsAt: new Date('2026-01-31T09:00:00.000Z'),
        endsAt: new Date('2026-01-31T10:00:00.000Z'),
        rrule: 'FREQ=MONTHLY',
      }),
      { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-05-01T00:00:00.000Z') }
    );

    // February and April have no 31st, so they produce nothing at all. The
    // March instance keeps its 10:00 wall time even though DST has moved the
    // underlying instant an hour earlier in UTC.
    expect(localStarts(occurrences)).toEqual(['2026-01-31 10:00', '2026-03-31 10:00']);
    expect(occurrences[1].startsAt.toISOString()).toBe('2026-03-31T08:00:00.000Z');
  });

  it('resolves a negative BYMONTHDAY from the end of the month', () => {
    const rule = parseRule('FREQ=MONTHLY;BYMONTHDAY=-1', AMSTERDAM);
    expect(rule).not.toBeNull();

    const occurrences = occurrencesOf(rule!, {
      start: new Date('2026-01-31T09:00:00.000Z'),
      timeZone: AMSTERDAM,
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-04-01T00:00:00.000Z'),
    });

    expect(occurrences.map((value) => value.toISOString().slice(0, 10))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });
});

describe('rule parsing honesty', () => {
  it('reports parts it cannot model instead of dropping them silently', () => {
    const rule = parseRule('FREQ=WEEKLY;BYWEEKNO=3;BYDAY=MO', AMSTERDAM);

    expect(rule?.unsupported).toEqual(['BYWEEKNO']);
    expect(rule?.byDay).toEqual([{ weekday: 'MO', ordinal: null }]);
  });

  it('rejects a rule with no FREQ', () => {
    expect(parseRule('INTERVAL=2;BYDAY=MO', AMSTERDAM)).toBeNull();
  });

  it('reads every RRULE line of a multi-rule series', () => {
    expect(rulesOf(series({ rrule: 'FREQ=WEEKLY;BYDAY=MO\nFREQ=WEEKLY;BYDAY=FR' }))).toHaveLength(
      2
    );
  });
});

describe('dayKeysOf', () => {
  it('buckets a timed event in the viewer zone', () => {
    expect(
      dayKeysOf(
        {
          startsAt: new Date('2026-03-02T07:30:00.000Z'),
          endsAt: new Date('2026-03-02T08:30:00.000Z'),
        },
        AMSTERDAM,
        false
      )
    ).toEqual(['2026-03-02']);
  });

  it('keeps a one-day all-day event on one day despite its exclusive end', () => {
    expect(
      dayKeysOf(
        {
          startsAt: new Date('2026-03-02T00:00:00.000Z'),
          endsAt: new Date('2026-03-03T00:00:00.000Z'),
        },
        AMSTERDAM,
        true
      )
    ).toEqual(['2026-03-02']);
  });

  it('spans every day a multi-day all-day event covers', () => {
    expect(
      dayKeysOf(
        {
          startsAt: new Date('2026-03-02T00:00:00.000Z'),
          endsAt: new Date('2026-03-05T00:00:00.000Z'),
        },
        AMSTERDAM,
        true
      )
    ).toEqual(['2026-03-02', '2026-03-03', '2026-03-04']);
  });

  it('keeps a timed event ending exactly at midnight on the day it started', () => {
    // 22:00 → 00:00 Amsterdam: the end instant belongs to the next day, but
    // the event does not, so the exclusive-end rule must keep it on the 2nd.
    expect(
      dayKeysOf(
        {
          startsAt: new Date('2026-03-02T21:00:00.000Z'),
          endsAt: new Date('2026-03-02T23:00:00.000Z'),
        },
        AMSTERDAM,
        false
      )
    ).toEqual(['2026-03-02']);
  });

  it('spans both days for a timed event that crosses midnight', () => {
    expect(
      dayKeysOf(
        {
          startsAt: new Date('2026-03-02T21:00:00.000Z'),
          endsAt: new Date('2026-03-03T01:00:00.000Z'),
        },
        AMSTERDAM,
        false
      )
    ).toEqual(['2026-03-02', '2026-03-03']);
  });
});
