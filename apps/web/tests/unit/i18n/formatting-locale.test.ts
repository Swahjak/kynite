import { describe, expect, it } from 'vitest';
import {
  FORMATTING_LOCALES,
  defaultFormattingLocale,
  formatDateTime,
  isFormattingLocale,
} from '@/i18n/formatting-locale';

/**
 * The bug this module exists to fix: bare `en` has no date/time convention of
 * its own, so every `Intl` call resolves it to `en-US` (`m/d/yyyy`, 12-hour)
 * the instant the UI locale isn't region-qualified. These pin the household
 * setting's three options to the conventions the settings copy promises
 * (`messages/{nl,en}.json`'s `settings.family.formattingLocales`), and the UI
 * locale → default mapping `(app)/layout.tsx` and `(hub)/layout.tsx` fall back
 * to when no household has chosen one yet.
 */
describe('defaultFormattingLocale', () => {
  it('defaults nl to nl-NL', () => {
    expect(defaultFormattingLocale('nl')).toBe('nl-NL');
  });

  it('defaults en to en-GB, not the Intl fallback of en-US', () => {
    expect(defaultFormattingLocale('en')).toBe('en-GB');
  });
});

describe('isFormattingLocale', () => {
  it('accepts exactly the three household options', () => {
    for (const locale of FORMATTING_LOCALES) {
      expect(isFormattingLocale(locale)).toBe(true);
    }
  });

  it('rejects bare language codes and other strings', () => {
    expect(isFormattingLocale('en')).toBe(false);
    expect(isFormattingLocale('nl')).toBe(false);
    expect(isFormattingLocale('fr-FR')).toBe(false);
    expect(isFormattingLocale(undefined)).toBe(false);
    expect(isFormattingLocale(42)).toBe(false);
  });
});

describe('formatDateTime', () => {
  // 14 August 2026, 17:05 UTC — an afternoon time (rules out an accidental
  // 12-hour/24-hour tie) on a day where `dd` and `mm` also disagree.
  const instant = new Date('2026-08-14T17:05:00Z');
  const dateOptions: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  };

  it('renders nl-NL as dd-mm-yyyy, 24-hour', () => {
    expect(formatDateTime(instant, 'nl-NL', dateOptions)).toBe('14-08-2026');
    expect(formatDateTime(instant, 'nl-NL', timeOptions)).toBe('17:05');
  });

  it('renders en-GB as dd/mm/yyyy, 24-hour — the household default for English', () => {
    expect(formatDateTime(instant, 'en-GB', dateOptions)).toBe('14/08/2026');
    expect(formatDateTime(instant, 'en-GB', timeOptions)).toBe('17:05');
  });

  it('renders en-US as mm/dd/yyyy, 12-hour — opt-in only, never the silent default', () => {
    expect(formatDateTime(instant, 'en-US', dateOptions)).toBe('08/14/2026');
    expect(formatDateTime(instant, 'en-US', timeOptions)).toBe('05:05 PM');
  });
});
