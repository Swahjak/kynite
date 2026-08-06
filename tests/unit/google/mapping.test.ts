import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMEZONE,
  EventMappingError,
  UNTITLED,
  fromGoogleEvent,
  isTombstone,
  toAllDayDate,
  toGoogleEvent,
} from '@/modules/google/domain/mapping';
import { googleEvent, tombstone } from './support/fixtures';

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
