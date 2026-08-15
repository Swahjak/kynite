import { describe, expect, it } from 'vitest';
import { UNTITLED_TITLE, titleOf } from '@/modules/calendar/domain/event-title';

/**
 * The untitled sentinel, and the bug that motivated pulling it into `domain/`.
 *
 * Google's API returns a `summary`-less event for anything a user created by
 * dragging a slot and never naming, and M05's mapper stores the literal
 * `(no title)` for it (`modules/google/domain/mapping.ts`). Three surfaces
 * translated that sentinel back into a locale string; `/today`'s two did not,
 * so a synced nameless event rendered the English parenthetical `(no title)`
 * on a Dutch wall display. Four copies of a comparison is three chances to
 * forget it, which is exactly what happened, so there is now one.
 *
 * The tests below pin the four inputs the comparison has to get right — the
 * sentinel, nothing, whitespace, and a real title — plus the one it must *not*
 * over-match: a genuine title that happens to contain the sentinel's text.
 * "Vergadering (no title) bespreken" is a title somebody wrote, and blanking
 * it would lose data the family typed in.
 */

describe('titleOf', () => {
  it('translates the sentinel a Google-synced nameless event carries', () => {
    expect(titleOf({ title: UNTITLED_TITLE }, { untitled: 'Zonder titel' })).toBe('Zonder titel');
  });

  it('treats an empty title as untitled', () => {
    // An ICS import can produce this where Google produces the sentinel.
    expect(titleOf({ title: '' }, { untitled: 'Zonder titel' })).toBe('Zonder titel');
  });

  it('treats a whitespace-only title as untitled', () => {
    expect(titleOf({ title: '   \t\n ' }, { untitled: 'Zonder titel' })).toBe('Zonder titel');
  });

  it('leaves a real title alone', () => {
    expect(titleOf({ title: 'Tandarts Mila' }, { untitled: 'Zonder titel' })).toBe('Tandarts Mila');
  });

  it('does not over-match a title that merely contains the sentinel', () => {
    const written = 'Vergadering (no title) bespreken';
    expect(titleOf({ title: written }, { untitled: 'Zonder titel' })).toBe(written);
  });

  it('does not trim a real title', () => {
    // Only the all-whitespace case is a fallback; leading space in a real
    // title is the family's own typing, and the layout, not this, handles it.
    expect(titleOf({ title: '  Tandarts' }, { untitled: 'Zonder titel' })).toBe('  Tandarts');
  });

  describe('busyOnly', () => {
    it('says "busy" instead of any title when detail was withheld', () => {
      // A redacted instance still carries whatever title the private calendar
      // had; showing it would defeat the redaction.
      const label = titleOf(
        { title: 'Sollicitatiegesprek', busyOnly: true },
        { untitled: 'Zonder titel', busy: 'Bezet' }
      );
      expect(label).toBe('Bezet');
    });

    it('outranks the untitled fallback', () => {
      const label = titleOf(
        { title: UNTITLED_TITLE, busyOnly: true },
        { untitled: 'Zonder titel', busy: 'Bezet' }
      );
      expect(label).toBe('Bezet');
    });

    it('is ignored by a caller that does not pass a busy label', () => {
      // The share board and any future read-only surface may render busy
      // blocks itself; without the label there is nothing to substitute.
      expect(titleOf({ title: 'Werk', busyOnly: true }, { untitled: 'Zonder titel' })).toBe('Werk');
    });
  });
});
