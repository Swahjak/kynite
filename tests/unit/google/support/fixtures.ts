import type { GoogleEventResource } from '@/modules/google/domain/types';

/**
 * Recorded-shape Google payloads.
 *
 * The recurrence fixtures are the custody patterns docs/architecture.md §3
 * names by hand — they are the reason `singleEvents=false` exists, and the
 * reason risk §11.7 calls the fixture suite non-negotiable.
 */

export function googleEvent(overrides: Partial<GoogleEventResource> = {}): GoogleEventResource {
  return {
    id: 'evt-1',
    status: 'confirmed',
    etag: '"etag-1"',
    summary: 'Zwemles Bram',
    updated: '2026-08-01T09:00:00.000Z',
    start: { dateTime: '2026-08-03T16:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    end: { dateTime: '2026-08-03T17:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    ...overrides,
  };
}

export function tombstone(id: string): GoogleEventResource {
  // A cancelled resource is the whole payload Google sends for a deletion.
  return { id, status: 'cancelled', etag: '"etag-gone"', updated: '2026-08-02T10:00:00.000Z' };
}

/** §3 custody patterns, verbatim. */
export const CUSTODY_RECURRENCES = {
  /** Alternating weeks. */
  alternatingWeeks: ['RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO'],
  /**
   * 2-2-3 rotation as §3's "two RRULEs on one custody event series": two
   * fortnightly rules whose day sets interleave to 2-2-3.
   */
  twoTwoThree: [
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=WE,TH,FR,SA,SU',
  ],
  /** Every 1st and 3rd weekend. */
  firstAndThirdWeekend: ['RRULE:FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3'],
  /** A series with a skipped instance and an extra date. */
  withExceptions: [
    'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
    'EXDATE;TZID=Europe/Amsterdam:20260817T090000',
    'RDATE;TZID=Europe/Amsterdam:20260901T090000',
  ],
} as const;

/** A recurring master plus the override child §3 describes. */
export function custodySeries(): { master: GoogleEventResource; override: GoogleEventResource } {
  const master = googleEvent({
    id: 'custody-master',
    summary: 'Week bij papa',
    etag: '"etag-master"',
    start: { dateTime: '2026-08-03T09:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    end: { dateTime: '2026-08-10T09:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    recurrence: [...CUSTODY_RECURRENCES.withExceptions],
  });

  const override = googleEvent({
    id: 'custody-master_20260817T070000Z',
    summary: 'Week bij papa (geruild)',
    etag: '"etag-override"',
    recurringEventId: 'custody-master',
    originalStartTime: { dateTime: '2026-08-17T09:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    start: { dateTime: '2026-08-18T09:00:00+02:00', timeZone: 'Europe/Amsterdam' },
    end: { dateTime: '2026-08-25T09:00:00+02:00', timeZone: 'Europe/Amsterdam' },
  });

  return { master, override };
}
