import { describe, expect, it } from 'vitest';
import { expandSeries } from '@/modules/calendar/domain/expand';
import {
  parseDuration,
  parseIcs,
  parseLine,
  unescapeText,
  unfold,
} from '@/modules/ics/domain/parse';

/**
 * ICS reading (M25).
 *
 * The interesting assertions are not "does it find a SUMMARY" but the three
 * places a naive reader silently gets a family's calendar wrong: an all-day
 * date read in a timezone, a VALARM's properties leaking into its event, and a
 * recurrence whose EXDATE stops matching after the clocks change. The last of
 * those is asserted *through* `expandSeries` — the whole point of storing the
 * recurrence verbatim is that the existing expander does the work, so a test
 * that only compared strings would prove nothing about what a parent sees.
 */

const AMS = 'Europe/Amsterdam';

function feed(body: string): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//test//EN', body, 'END:VCALENDAR'].join(
    '\r\n'
  );
}

describe('unfold', () => {
  it('joins continuation lines and drops the leading whitespace', () => {
    expect(unfold('SUMMARY:Ouder\r\n avond\r\nUID:1')).toEqual(['SUMMARY:Ouderavond', 'UID:1']);
  });

  it('accepts tab folding and bare newlines', () => {
    expect(unfold('SUMMARY:a\n\tb')).toEqual(['SUMMARY:ab']);
  });

  it('drops blank lines rather than treating them as properties', () => {
    expect(unfold('UID:1\r\n\r\nUID:2')).toEqual(['UID:1', 'UID:2']);
  });
});

describe('parseLine', () => {
  it('splits name, parameters and value', () => {
    const line = parseLine('DTSTART;TZID=Europe/Amsterdam;VALUE=DATE-TIME:20260302T083000');

    expect(line).toMatchObject({
      name: 'DTSTART',
      params: { TZID: 'Europe/Amsterdam', VALUE: 'DATE-TIME' },
      value: '20260302T083000',
    });
  });

  it('does not split inside a quoted parameter containing a colon', () => {
    const line = parseLine('DTSTART;TZID="(UTC+01:00) Amsterdam":20260302T083000');

    expect(line?.params.TZID).toBe('(UTC+01:00) Amsterdam');
    expect(line?.value).toBe('20260302T083000');
  });
});

describe('unescapeText', () => {
  it('unescapes the four TEXT escapes', () => {
    expect(unescapeText('regel1\\nregel2\\, en\\; ook\\\\')).toBe('regel1\nregel2, en; ook\\');
  });
});

describe('parseDuration', () => {
  it.each([
    ['PT1H', 3_600_000],
    ['PT30M', 1_800_000],
    ['P1D', 86_400_000],
    ['P1W', 604_800_000],
    ['P1DT2H30M', 95_400_000],
  ])('reads %s', (value, expected) => {
    expect(parseDuration(value)).toBe(expected);
  });

  it('returns null for nonsense', () => {
    expect(parseDuration('P')).toBeNull();
    expect(parseDuration('1 hour')).toBeNull();
  });
});

describe('parseIcs', () => {
  it('reads a timed event in its own zone', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:evt-1@school.example',
          'SUMMARY:Ouderavond groep 5',
          'LOCATION:Aula',
          'DESCRIPTION:Neem het rapport mee',
          'DTSTART;TZID=Europe/Amsterdam:20260302T190000',
          'DTEND;TZID=Europe/Amsterdam:20260302T203000',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: 'evt-1@school.example',
      sourceUid: 'evt-1@school.example',
      title: 'Ouderavond groep 5',
      location: 'Aula',
      description: 'Neem het rapport mee',
      allDay: false,
      tz: AMS,
    });
    // 19:00 Amsterdam in March is CET (UTC+1) until the 29th.
    expect(events[0].startsAt.toISOString()).toBe('2026-03-02T18:00:00.000Z');
    expect(events[0].endsAt.toISOString()).toBe('2026-03-02T19:30:00.000Z');
  });

  it('stores an all-day date as a zoneless UTC midnight, end exclusive', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:vak-1',
          'SUMMARY:Voorjaarsvakantie',
          'DTSTART;VALUE=DATE:20260214',
          'DTEND;VALUE=DATE:20260223',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events[0].allDay).toBe(true);
    expect(events[0].startsAt.toISOString()).toBe('2026-02-14T00:00:00.000Z');
    expect(events[0].endsAt.toISOString()).toBe('2026-02-23T00:00:00.000Z');
  });

  it('gives a bare all-day DTSTART a one-day exclusive end', () => {
    const { events } = parseIcs(
      feed(['BEGIN:VEVENT', 'UID:d-1', 'DTSTART;VALUE=DATE:20260302', 'END:VEVENT'].join('\r\n')),
      { defaultTimeZone: AMS }
    );

    expect(events[0].endsAt.toISOString()).toBe('2026-03-03T00:00:00.000Z');
  });

  it('reads a UTC value as an instant and a DURATION as a length', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:z-1',
          'DTSTART:20260302T070000Z',
          'DURATION:PT45M',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events[0].startsAt.toISOString()).toBe('2026-03-02T07:00:00.000Z');
    expect(events[0].endsAt.toISOString()).toBe('2026-03-02T07:45:00.000Z');
  });

  it('never reads a VALARM as part of its event', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:alarm-1',
          'SUMMARY:Zwemles',
          'DTSTART;TZID=Europe/Amsterdam:20260302T160000',
          'DTEND;TZID=Europe/Amsterdam:20260302T164500',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:Vergeet de zwemtas niet',
          'DURATION:PT10M',
          'TRIGGER:-PT30M',
          'END:VALARM',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Zwemles');
    // The alarm's own DESCRIPTION and DURATION belong to the alarm.
    expect(events[0].description).toBeNull();
    expect(events[0].endsAt.toISOString()).toBe('2026-03-02T15:45:00.000Z');
  });

  it('ignores VTIMEZONE bodies, which also carry DTSTART lines', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VTIMEZONE',
          'TZID:Europe/Amsterdam',
          'BEGIN:DAYLIGHT',
          'DTSTART:19700329T020000',
          'TZOFFSETFROM:+0100',
          'TZOFFSETTO:+0200',
          'END:DAYLIGHT',
          'END:VTIMEZONE',
          'BEGIN:VEVENT',
          'UID:tz-1',
          'SUMMARY:Wedstrijd',
          'DTSTART;TZID=Europe/Amsterdam:20260704T100000',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events.map((entry) => entry.uid)).toEqual(['tz-1']);
  });

  it('skips a cancelled entry and an entry with no UID or DTSTART', () => {
    const { events } = parseIcs(
      feed(
        [
          'BEGIN:VEVENT',
          'UID:c-1',
          'STATUS:CANCELLED',
          'DTSTART:20260302T070000Z',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'SUMMARY:geen uid',
          'DTSTART:20260302T070000Z',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:ok-1',
          'DTSTART:20260302T070000Z',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: AMS }
    );

    expect(events.map((entry) => entry.uid)).toEqual(['ok-1']);
  });

  it('reads the calendar name and zone, and maps a Windows zone id', () => {
    const parsed = parseIcs(
      feed(
        [
          'X-WR-CALNAME:Schoolagenda Mila',
          'X-WR-TIMEZONE:W. Europe Standard Time',
          'BEGIN:VEVENT',
          'UID:n-1',
          'DTSTART:20260302T070000Z',
          'END:VEVENT',
        ].join('\r\n')
      ),
      { defaultTimeZone: 'UTC' }
    );

    expect(parsed.name).toBe('Schoolagenda Mila');
    expect(parsed.timeZone).toBe(AMS);
  });

  it('names an untitled event rather than writing a null title', () => {
    const { events } = parseIcs(
      feed(['BEGIN:VEVENT', 'UID:u-1', 'DTSTART:20260302T070000Z', 'END:VEVENT'].join('\r\n')),
      { defaultTimeZone: AMS }
    );

    expect(events[0].title).toBe('(no title)');
  });

  it('caps the number of events taken from one feed', () => {
    const many = Array.from({ length: 10 }, (_, index) =>
      ['BEGIN:VEVENT', `UID:m-${index}`, 'DTSTART:20260302T070000Z', 'END:VEVENT'].join('\r\n')
    ).join('\r\n');

    expect(parseIcs(feed(many), { defaultTimeZone: AMS, maxEvents: 4 }).events).toHaveLength(4);
  });

  describe('recurrence', () => {
    const weekly = feed(
      [
        'BEGIN:VEVENT',
        'UID:rec-1',
        'SUMMARY:Zwemles',
        'DTSTART;TZID=Europe/Amsterdam:20260302T160000',
        'DTEND;TZID=Europe/Amsterdam:20260302T164500',
        'RRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=6',
        'EXDATE;TZID=Europe/Amsterdam:20260316T160000',
        'END:VEVENT',
      ].join('\r\n')
    );

    it('keeps RRULE, EXDATE and RDATE lines verbatim', () => {
      const [parsed] = parseIcs(weekly, { defaultTimeZone: AMS }).events;

      expect(parsed.rrule).toBe('FREQ=WEEKLY;BYDAY=MO;COUNT=6');
      expect(parsed.exdates).toEqual(['EXDATE;TZID=Europe/Amsterdam:20260316T160000']);
      expect(parsed.rdates).toEqual([]);
    });

    it('expands through the existing engine, EXDATE and DST included', () => {
      const [parsed] = parseIcs(weekly, { defaultTimeZone: AMS }).events;

      const occurrences = expandSeries(
        { id: 'series', ...parsed },
        { from: new Date('2026-03-01T00:00:00Z'), to: new Date('2026-05-01T00:00:00Z') }
      );

      expect(occurrences.map((occurrence) => occurrence.startsAt.toISOString())).toEqual([
        '2026-03-02T15:00:00.000Z',
        '2026-03-09T15:00:00.000Z',
        // 16 March is the EXDATE.
        '2026-03-23T15:00:00.000Z',
        // Clocks go forward on 29 March: 16:00 local is now 14:00 UTC, which is
        // the whole reason the row stores a zone rather than an offset.
        '2026-03-30T14:00:00.000Z',
        '2026-04-06T14:00:00.000Z',
      ]);
    });

    it('reads multiple RRULEs as newline-joined values', () => {
      const [parsed] = parseIcs(
        feed(
          [
            'BEGIN:VEVENT',
            'UID:rec-2',
            'DTSTART;TZID=Europe/Amsterdam:20260302T080000',
            'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
            'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,WE',
            'END:VEVENT',
          ].join('\r\n')
        ),
        { defaultTimeZone: AMS }
      ).events;

      expect(parsed.rrule).toBe(
        'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO\nFREQ=WEEKLY;INTERVAL=2;BYDAY=TU,WE'
      );
    });

    it('gives an override instance its own key and its original slot', () => {
      const { events } = parseIcs(
        feed(
          [
            'BEGIN:VEVENT',
            'UID:rec-3',
            'DTSTART;TZID=Europe/Amsterdam:20260302T160000',
            'RRULE:FREQ=WEEKLY;BYDAY=MO',
            'END:VEVENT',
            'BEGIN:VEVENT',
            'UID:rec-3',
            'RECURRENCE-ID;TZID=Europe/Amsterdam:20260309T160000',
            'DTSTART;TZID=Europe/Amsterdam:20260309T173000',
            'END:VEVENT',
          ].join('\r\n')
        ),
        { defaultTimeZone: AMS }
      );

      expect(events.map((entry) => entry.sourceUid)).toEqual([
        'rec-3',
        'rec-3::2026-03-09T15:00:00.000Z',
      ]);
      expect(events[1].overrideOf).toBe('rec-3');
      expect(events[1].recurrenceOriginalStart?.toISOString()).toBe('2026-03-09T15:00:00.000Z');
    });
  });
});
