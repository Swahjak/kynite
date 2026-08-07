import { describe, expect, it } from 'vitest';
import {
  AFTERNOON_FROM_HOUR,
  EVENING_FROM_HOUR,
  firstNameOf,
  greetingSlotFor,
  hourIn,
} from '@/modules/family/domain/greeting';

/**
 * M18: `(app)/today` opens with a greeting instead of the word "Vandaag".
 *
 * The boundaries are pinned rather than described, because the interesting
 * cases are exactly the edges — noon, six, and the small hours, which fold back
 * into "evening" rather than growing a fourth bucket that would tell a parent
 * something about their bedtime.
 */
describe('greetingSlotFor', () => {
  it('splits the day at noon and at six', () => {
    expect(greetingSlotFor(AFTERNOON_FROM_HOUR - 1)).toBe('morning');
    expect(greetingSlotFor(AFTERNOON_FROM_HOUR)).toBe('afternoon');
    expect(greetingSlotFor(EVENING_FROM_HOUR - 1)).toBe('afternoon');
    expect(greetingSlotFor(EVENING_FROM_HOUR)).toBe('evening');
    expect(greetingSlotFor(23)).toBe('evening');
  });

  it('keeps the small hours in the evening', () => {
    // 01:00 is the tail of somebody's evening, not the start of their morning.
    expect(greetingSlotFor(0)).toBe('evening');
    expect(greetingSlotFor(4)).toBe('evening');
    expect(greetingSlotFor(5)).toBe('morning');
  });
});

describe('firstNameOf', () => {
  it('takes the first word', () => {
    expect(firstNameOf('Sofie de Vries')).toBe('Sofie');
    expect(firstNameOf('Bram')).toBe('Bram');
    expect(firstNameOf('  Anne   Marie ')).toBe('Anne');
  });

  it('yields an empty string for a blank name, which the caller reads as "no greeting"', () => {
    expect(firstNameOf('')).toBe('');
    expect(firstNameOf('   ')).toBe('');
  });
});

describe('hourIn', () => {
  it('reads the clock in the household timezone, not the process one', () => {
    // 21:30 UTC is the next morning in Auckland and still the evening in
    // Amsterdam — a family in Curaçao must not be wished a good evening over
    // breakfast, which is the whole reason this takes a zone at all.
    const instant = new Date('2026-08-07T21:30:00.000Z');

    expect(hourIn(instant, 'UTC')).toBe(21);
    expect(hourIn(instant, 'Europe/Amsterdam')).toBe(23);
    expect(hourIn(instant, 'America/Curacao')).toBe(17);
  });

  it('normalises a midnight rendered as 24', () => {
    expect(hourIn(new Date('2026-08-07T00:00:00.000Z'), 'UTC')).toBe(0);
  });
});
