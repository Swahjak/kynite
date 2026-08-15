import { describe, expect, it } from 'vitest';
import {
  isRecurring,
  parseRecurrence,
  serializeRecurrence,
} from '@/modules/google/domain/recurrence';
import { fromGoogleEvent, toGoogleEvent } from '@/modules/google/domain/mapping';
import { CUSTODY_RECURRENCES, custodySeries } from './support/fixtures';

/**
 * RRULE fidelity (docs/architecture.md §3 "Recurrence decision", risk §11.7).
 *
 * Every custody pattern §3 names must survive Google → row → Google unchanged,
 * byte for byte. This is the suite the milestone calls non-negotiable: an
 * RRULE that round-trips lossily is a custody week in the wrong house.
 */

/**
 * Line *order* is normalised to RRULE → RDATE → EXDATE (RFC-5545 gives
 * property order no meaning); every line's value is byte-identical.
 */
const asSet = (lines: readonly string[]): string[] => [...lines].sort();

describe('custody patterns round-trip verbatim', () => {
  for (const [name, lines] of Object.entries(CUSTODY_RECURRENCES)) {
    it(name, () => {
      const parsed = parseRecurrence(lines);
      expect(asSet(serializeRecurrence(parsed))).toEqual(asSet(lines));
    });
  }

  it('emits RRULE, then RDATE, then EXDATE', () => {
    const parsed = parseRecurrence(CUSTODY_RECURRENCES.withExceptions);
    expect(serializeRecurrence(parsed)).toEqual([
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      'RDATE;TZID=Europe/Amsterdam:20260901T090000',
      'EXDATE;TZID=Europe/Amsterdam:20260817T090000',
    ]);
  });

  it('alternating weeks keeps INTERVAL and BYDAY', () => {
    const parsed = parseRecurrence(CUSTODY_RECURRENCES.alternatingWeeks);
    expect(parsed.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
    expect(parsed.exdates).toEqual([]);
  });

  it('a 2-2-3 rotation keeps *both* RRULEs on one series', () => {
    const parsed = parseRecurrence(CUSTODY_RECURRENCES.twoTwoThree);
    // Two content lines in one text column, joined the way RFC-5545 separates
    // them — the column is single, the rule set is not.
    expect(parsed.rrule?.split('\n')).toHaveLength(2);
    expect(serializeRecurrence(parsed)).toEqual([...CUSTODY_RECURRENCES.twoTwoThree]);
    expect(parsed.rrule).toContain('BYDAY=WE,TH,FR,SA,SU');
  });

  it('BYSETPOS survives the first-and-third-weekend rule', () => {
    const parsed = parseRecurrence(CUSTODY_RECURRENCES.firstAndThirdWeekend);
    expect(parsed.rrule).toBe('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3');
  });

  it('EXDATE and RDATE keep their TZID parameters', () => {
    const parsed = parseRecurrence(CUSTODY_RECURRENCES.withExceptions);
    expect(parsed.exdates).toEqual(['EXDATE;TZID=Europe/Amsterdam:20260817T090000']);
    expect(parsed.rdates).toEqual(['RDATE;TZID=Europe/Amsterdam:20260901T090000']);
  });
});

describe('parseRecurrence', () => {
  it('returns a null rrule for a non-recurring event', () => {
    const parsed = parseRecurrence(undefined);
    expect(parsed).toEqual({ rrule: null, rdates: [], exdates: [] });
    expect(isRecurring(parsed)).toBe(false);
  });

  it('ignores blank lines and properties we do not model', () => {
    const parsed = parseRecurrence(['', 'RRULE:FREQ=DAILY', 'EXRULE:FREQ=MONTHLY']);
    expect(parsed.rrule).toBe('FREQ=DAILY');
    expect(serializeRecurrence(parsed)).toEqual(['RRULE:FREQ=DAILY']);
  });
});

describe('EXDATE + recurrenceParentId override round-trip', () => {
  it('maps a Google series and its override child, then serialises both back', () => {
    const { master, override } = custodySeries();

    const masterRow = fromGoogleEvent(master);
    const overrideRow = fromGoogleEvent(override);

    // The parent carries the exception; the child points at the parent (§3).
    expect(masterRow.exdates).toEqual(['EXDATE;TZID=Europe/Amsterdam:20260817T090000']);
    expect(masterRow.recurringEventId).toBeNull();
    expect(overrideRow.recurringEventId).toBe(master.id);
    expect(overrideRow.rrule).toBeNull();

    expect(asSet(toGoogleEvent(masterRow).recurrence!)).toEqual(asSet(master.recurrence!));
    // An override instance carries no recurrence of its own.
    expect(toGoogleEvent(overrideRow).recurrence).toBeUndefined();
  });
});
