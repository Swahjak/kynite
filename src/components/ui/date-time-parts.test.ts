import { describe, expect, it } from 'vitest';

import {
  datePatternFor,
  formatDateValue,
  formatTimeValue,
  joinDateTimeValue,
  parseDateInput,
  parseTimeInput,
  splitDateTimeValue,
  timePlaceholderFor,
  uses12Hour,
} from './date-time-parts';

/**
 * The bug these guard: an `<input type="date">`/`type="time"` renders in the
 * *browser's* locale, so an en-US Chrome showed `08/21/2026` and `2:30 PM` in
 * a household that had chosen `nl-NL`. Every assertion below is about the
 * household's convention deciding instead — and about the wire value
 * (`yyyy-MM-dd`, 24-hour `HH:mm`) never changing shape whichever convention
 * that is, since Server Actions parse it unchanged.
 */

describe('formatDateValue', () => {
  it('writes a date in each household convention', () => {
    expect(formatDateValue('2026-08-21', 'nl-NL')).toBe('21-08-2026');
    expect(formatDateValue('2026-08-21', 'en-GB')).toBe('21/08/2026');
    expect(formatDateValue('2026-08-21', 'en-US')).toBe('08/21/2026');
  });

  it('formats nothing rather than NaN for an empty or malformed value', () => {
    expect(formatDateValue('', 'nl-NL')).toBe('');
    expect(formatDateValue('not a date', 'en-US')).toBe('');
    // A shape that looks ISO but is not a real day.
    expect(formatDateValue('2026-02-30', 'nl-NL')).toBe('');
  });
});

describe('parseDateInput', () => {
  it('round-trips the display text back to the wire value in every locale', () => {
    for (const locale of ['nl-NL', 'en-GB', 'en-US'] as const) {
      const display = formatDateValue('2026-08-21', locale);
      expect(parseDateInput(display, locale)).toBe('2026-08-21');
    }
  });

  it('reads the same digits as different days in dmy and mdy households', () => {
    expect(parseDateInput('08/09/2026', 'en-GB')).toBe('2026-09-08');
    expect(parseDateInput('08/09/2026', 'en-US')).toBe('2026-08-09');
  });

  it('accepts any separator, not just the locale’s own', () => {
    expect(parseDateInput('21/08/2026', 'nl-NL')).toBe('2026-08-21');
    expect(parseDateInput('21.08.2026', 'nl-NL')).toBe('2026-08-21');
    expect(parseDateInput('21 08 2026', 'nl-NL')).toBe('2026-08-21');
  });

  it('accepts single-digit day and month', () => {
    expect(parseDateInput('1-8-2026', 'nl-NL')).toBe('2026-08-01');
    expect(parseDateInput('8/1/2026', 'en-US')).toBe('2026-08-01');
  });

  it('accepts a bare run of digits', () => {
    expect(parseDateInput('21082026', 'nl-NL')).toBe('2026-08-21');
    expect(parseDateInput('210826', 'nl-NL')).toBe('2026-08-21');
    expect(parseDateInput('08212026', 'en-US')).toBe('2026-08-21');
  });

  it('expands a two-digit year the way a birth date needs', () => {
    expect(parseDateInput('14-03-82', 'nl-NL')).toBe('1982-03-14');
    expect(parseDateInput('14-03-26', 'nl-NL')).toBe('2026-03-14');
    expect(parseDateInput('14-03-69', 'nl-NL')).toBe('2069-03-14');
    expect(parseDateInput('14-03-70', 'nl-NL')).toBe('1970-03-14');
  });

  it('accepts an ISO value in any locale, because no month is four digits', () => {
    expect(parseDateInput('2026-08-21', 'en-US')).toBe('2026-08-21');
    expect(parseDateInput('2026-08-21', 'nl-NL')).toBe('2026-08-21');
  });

  it('refuses an impossible day instead of rolling it forward', () => {
    expect(parseDateInput('31-02-2026', 'nl-NL')).toBeNull();
    expect(parseDateInput('00-08-2026', 'nl-NL')).toBeNull();
    expect(parseDateInput('21-13-2026', 'nl-NL')).toBeNull();
    // 2026 is not a leap year; 2028 is.
    expect(parseDateInput('29-02-2026', 'nl-NL')).toBeNull();
    expect(parseDateInput('29-02-2028', 'nl-NL')).toBe('2028-02-29');
  });

  it('refuses text that is not a date at all', () => {
    expect(parseDateInput('', 'nl-NL')).toBeNull();
    expect(parseDateInput('morgen', 'nl-NL')).toBeNull();
    expect(parseDateInput('21-08', 'nl-NL')).toBeNull();
    expect(parseDateInput('21-08-202', 'nl-NL')).toBeNull();
    expect(parseDateInput('2108202', 'nl-NL')).toBeNull();
  });
});

describe('formatTimeValue', () => {
  it('is 24-hour outside the United States and 12-hour inside it', () => {
    expect(formatTimeValue('14:30', 'nl-NL')).toBe('14:30');
    expect(formatTimeValue('14:30', 'en-GB')).toBe('14:30');
    expect(formatTimeValue('14:30', 'en-US')).toBe('2:30 PM');
  });

  it('handles both ends of the 12-hour clock', () => {
    expect(formatTimeValue('00:05', 'en-US')).toBe('12:05 AM');
    expect(formatTimeValue('12:00', 'en-US')).toBe('12:00 PM');
    expect(formatTimeValue('00:05', 'nl-NL')).toBe('00:05');
  });

  it('uses a plain space before AM/PM, not the narrow one ICU emits', () => {
    expect(formatTimeValue('09:00', 'en-US')).toBe('9:00 AM');
    expect(formatTimeValue('09:00', 'en-US')).not.toContain('\u202f');
  });

  it('formats nothing for an empty or malformed value', () => {
    expect(formatTimeValue('', 'en-US')).toBe('');
    expect(formatTimeValue('25:00', 'nl-NL')).toBe('');
    expect(formatTimeValue('9:30', 'nl-NL')).toBe('');
  });
});

describe('parseTimeInput', () => {
  it('round-trips the display text back to 24-hour wire time', () => {
    for (const locale of ['nl-NL', 'en-GB', 'en-US'] as const) {
      expect(parseTimeInput(formatTimeValue('14:30', locale))).toBe('14:30');
      expect(parseTimeInput(formatTimeValue('00:05', locale))).toBe('00:05');
    }
  });

  it('normalises the shorthands people actually type', () => {
    expect(parseTimeInput('930')).toBe('09:30');
    expect(parseTimeInput('9:30')).toBe('09:30');
    expect(parseTimeInput('09.30')).toBe('09:30');
    expect(parseTimeInput('9 30')).toBe('09:30');
    expect(parseTimeInput('1430')).toBe('14:30');
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput('21')).toBe('21:00');
    expect(parseTimeInput('  7:05  ')).toBe('07:05');
  });

  it('converts a meridiem to 24-hour, in whatever shape it was typed', () => {
    expect(parseTimeInput('2:30 pm')).toBe('14:30');
    expect(parseTimeInput('2:30PM')).toBe('14:30');
    expect(parseTimeInput('230 pm')).toBe('14:30');
    expect(parseTimeInput('2:30p')).toBe('14:30');
    expect(parseTimeInput('2:30 p.m.')).toBe('14:30');
    expect(parseTimeInput('9pm')).toBe('21:00');
  });

  it('gets midnight and noon right, where 12-hour clocks usually go wrong', () => {
    expect(parseTimeInput('12:00 am')).toBe('00:00');
    expect(parseTimeInput('12:30 am')).toBe('00:30');
    expect(parseTimeInput('12:00 pm')).toBe('12:00');
    expect(parseTimeInput('12:30 pm')).toBe('12:30');
  });

  it('reads bare digits as a 24-hour clock, the only reading that cannot be 12 hours wrong', () => {
    expect(parseTimeInput('14:30')).toBe('14:30');
    expect(parseTimeInput('00:30')).toBe('00:30');
  });

  it('refuses impossible and non-numeric times', () => {
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('24:00')).toBeNull();
    expect(parseTimeInput('12:60')).toBeNull();
    expect(parseTimeInput('13:00 pm')).toBeNull();
    expect(parseTimeInput('0:00 am')).toBeNull();
    expect(parseTimeInput('straks')).toBeNull();
    expect(parseTimeInput('9:3')).toBeNull();
    expect(parseTimeInput('123456')).toBeNull();
  });
});

describe('patterns and placeholders', () => {
  it('hints the pattern in the household’s own writing', () => {
    expect(datePatternFor('nl-NL').placeholder).toBe('dd-mm-jjjj');
    expect(datePatternFor('en-GB').placeholder).toBe('dd/mm/yyyy');
    expect(datePatternFor('en-US').placeholder).toBe('mm/dd/yyyy');
    expect(timePlaceholderFor('nl-NL')).toBe('uu:mm');
    expect(timePlaceholderFor('en-GB')).toBe('hh:mm');
    expect(timePlaceholderFor('en-US')).toBe('hh:mm AM');
  });

  it('marks only en-US as a 12-hour convention', () => {
    expect(uses12Hour('en-US')).toBe(true);
    expect(uses12Hour('en-GB')).toBe(false);
    expect(uses12Hour('nl-NL')).toBe(false);
  });
});

describe('datetime wire values', () => {
  it('splits and rejoins the `datetime-local` shape the calendar submits', () => {
    expect(splitDateTimeValue('2026-08-21T14:30')).toEqual({ date: '2026-08-21', time: '14:30' });
    expect(splitDateTimeValue('2026-08-21T14:30:00')).toEqual({
      date: '2026-08-21',
      time: '14:30',
    });
    expect(splitDateTimeValue('')).toEqual({ date: '', time: '' });
    expect(joinDateTimeValue('2026-08-21', '14:30')).toBe('2026-08-21T14:30');
  });

  it('emits nothing while only one half is filled in', () => {
    expect(joinDateTimeValue('2026-08-21', '')).toBe('');
    expect(joinDateTimeValue('', '14:30')).toBe('');
  });
});
