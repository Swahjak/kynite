import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  EventMappingError,
  UNTITLED,
  fromGoogleEvent,
  isStatusOnly,
  isTombstone,
  toAllDayDate,
  toGoogleEvent,
} from '@/modules/google/domain/mapping';
import { googleEvent, importedSeries, statusEntry, tombstone } from './support/fixtures';

/** Google `events` resource ⇄ `event` row (docs/architecture.md §3). */

describe('fromGoogleEvent', () => {
  it('maps a timed event with its original zone', () => {
    const mapped = fromGoogleEvent(googleEvent());

    expect(mapped).toMatchObject({
      googleEventId: 'evt-1',
      title: 'Zwemles Bram',
      allDay: false,
      tz: 'Europe/Amsterdam',
      etag: '"etag-1"',
    });
    expect(mapped.startsAt.toISOString()).toBe('2026-08-03T14:00:00.000Z');
    expect(mapped.updatedAtRemote?.toISOString()).toBe('2026-08-01T09:00:00.000Z');
  });

  it('maps an all-day event and keeps Google exclusive end dates', () => {
    const mapped = fromGoogleEvent(
      googleEvent({ start: { date: '2026-08-03' }, end: { date: '2026-08-04' } })
    );

    expect(mapped.allDay).toBe(true);
    expect(toAllDayDate(mapped.startsAt)).toBe('2026-08-03');
    // Not shifted back a day: the exclusive end is round-tripped as-is.
    expect(toAllDayDate(mapped.endsAt)).toBe('2026-08-04');
    expect(mapped.tz).toBe(DEFAULT_TIMEZONE);
  });

  it('names an untitled event rather than writing NULL into a NOT NULL column', () => {
    expect(fromGoogleEvent(googleEvent({ summary: undefined })).title).toBe(UNTITLED);
    expect(fromGoogleEvent(googleEvent({ summary: '   ' })).title).toBe(UNTITLED);
  });

  it('rejects an event with no usable start', () => {
    expect(() => fromGoogleEvent(googleEvent({ start: {} }))).toThrow(EventMappingError);
  });

  it('records the slot an override replaces, which Google leaves off the master', () => {
    const { master, override } = importedSeries();

    // The master's rule has no EXDATE for the overridden week — the exception
    // lives entirely on the instance, so `originalStartTime` is the only thing
    // that can stop the parent generating that slot twice.
    expect(fromGoogleEvent(master).rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(fromGoogleEvent(master).exdates).toEqual([]);
    expect(fromGoogleEvent(master).recurrenceOriginalStart).toBeNull();

    const mapped = fromGoogleEvent(override);
    expect(mapped.recurringEventId).toBe('weekly-master');
    expect(mapped.recurrenceOriginalStart?.toISOString()).toBe('2026-03-09T07:30:00.000Z');
  });

  it('leaves the original slot null for an ordinary event and for an unparsable one', () => {
    expect(fromGoogleEvent(googleEvent()).recurrenceOriginalStart).toBeNull();
    expect(
      fromGoogleEvent(googleEvent({ recurringEventId: 'master', originalStartTime: {} }))
        .recurrenceOriginalStart
    ).toBeNull();
  });
});

describe('isStatusOnly', () => {
  it('rejects the status entries a work calendar emits constantly', () => {
    for (const eventType of ['workingLocation', 'focusTime', 'outOfOffice']) {
      expect(isStatusOnly(statusEntry(eventType)), eventType).toBe(true);
    }
  });

  it('keeps the event types that are real appointments', () => {
    // `birthday` and `fromGmail` are deliberately *not* status entries: a
    // birthday is the one imported event a child looks for, and a Gmail-parsed
    // booking is a flight with a real time and a real place.
    for (const eventType of ['default', 'birthday', 'fromGmail', 'somethingGoogleAddedLater']) {
      expect(isStatusOnly(statusEntry(eventType)), eventType).toBe(false);
    }
    expect(isStatusOnly(googleEvent())).toBe(false);
  });
});

describe('toGoogleEvent', () => {
  it('round-trips a timed event', () => {
    const original = googleEvent();
    const body = toGoogleEvent(fromGoogleEvent(original));

    expect(body.summary).toBe(original.summary);
    expect(new Date(body.start.dateTime!).toISOString()).toBe(
      new Date(original.start!.dateTime!).toISOString()
    );
    expect(body.start.timeZone).toBe('Europe/Amsterdam');
    // No id on an update body: the id lives in the URL.
    expect(body.id).toBeUndefined();
  });

  it('round-trips an all-day event as dates, not timestamps', () => {
    const body = toGoogleEvent(
      fromGoogleEvent(googleEvent({ start: { date: '2026-08-03' }, end: { date: '2026-08-04' } }))
    );

    expect(body.start).toEqual({ date: '2026-08-03' });
    expect(body.end).toEqual({ date: '2026-08-04' });
  });

  it('carries a caller-assigned id when one is given (insert)', () => {
    expect(toGoogleEvent(fromGoogleEvent(googleEvent()), 'knabc123').id).toBe('knabc123');
  });
});

describe('isTombstone', () => {
  it('recognises a cancelled resource', () => {
    expect(isTombstone(tombstone('a'))).toBe(true);
    expect(isTombstone(googleEvent())).toBe(false);
  });
});
