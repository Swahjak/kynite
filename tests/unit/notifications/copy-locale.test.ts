import { describe, expect, it } from 'vitest';
import {
  reminderPayload,
  redemptionRequestPayload,
  resolveLocale,
} from '@/modules/notifications/copy';

/**
 * M15: push bodies are localized per `family.locale` (M11), but nothing
 * before this test asserted the *content actually differs* between locales
 * — a bug that silently fell back to `nl` for every family would pass a
 * type check and every existing delivery test, since those only assert
 * shape. This pins the two locales apart and pins the fallback/deep-link
 * behaviour `resolveLocale` and the `url` field depend on.
 */

describe('resolveLocale', () => {
  it('accepts a supported locale', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('nl')).toBe('nl');
  });

  it('falls back to the default locale for null, unset or unsupported values', () => {
    expect(resolveLocale(null)).toBe('nl');
    expect(resolveLocale(undefined)).toBe('nl');
    expect(resolveLocale('fr')).toBe('nl');
    expect(resolveLocale('')).toBe('nl');
  });
});

describe('reminderPayload is localized per family.locale', () => {
  const base = {
    routineTitle: 'Ochtendroutine',
    routineId: 'routine-1',
    occurrenceDate: '2026-08-10',
    memberId: 'member-1',
  };

  it('renders nl and en bodies differently for the same input', async () => {
    const nl = await reminderPayload({ ...base, locale: 'nl', minutes: 5 });
    const en = await reminderPayload({ ...base, locale: 'en', minutes: 5 });

    expect(nl.body).not.toEqual(en.body);
    expect(nl.body).toContain('5');
    expect(en.body).toContain('5');
  });

  it('deep-links into the locale-prefixed routines route', async () => {
    const nl = await reminderPayload({ ...base, locale: 'nl', minutes: 5 });
    const en = await reminderPayload({ ...base, locale: 'en', minutes: 5 });

    expect(nl.url).toBe('/nl/routines');
    expect(en.url).toBe('/en/routines');
  });

  it('falls back to nl for a family with no locale set', async () => {
    const fallback = await reminderPayload({ ...base, locale: null, minutes: 5 });
    const nl = await reminderPayload({ ...base, locale: 'nl', minutes: 5 });
    expect(fallback.body).toBe(nl.body);
    expect(fallback.url).toBe('/nl/routines');
  });

  it('switches copy at the due moment (minutes = 0) in both locales', async () => {
    const nl = await reminderPayload({ ...base, locale: 'nl', minutes: 0 });
    const en = await reminderPayload({ ...base, locale: 'en', minutes: 0 });
    expect(nl.body).not.toContain('5');
    expect(en.body).not.toContain('5');
    expect(nl.body).not.toEqual(en.body);
  });
});

describe('redemptionRequestPayload is localized per family.locale', () => {
  const base = { childName: 'Mila', rewardTitle: 'Zwembadje', redemptionId: 'redeem-1' };

  it('renders nl and en title/body differently for the same input', async () => {
    const nl = await redemptionRequestPayload({ ...base, locale: 'nl' });
    const en = await redemptionRequestPayload({ ...base, locale: 'en' });

    expect(nl.title).not.toEqual(en.title);
    expect(nl.body).not.toEqual(en.body);
    expect(nl.body).toContain('Mila');
    expect(en.body).toContain('Mila');
  });

  it('deep-links into the locale-prefixed rewards route', async () => {
    const nl = await redemptionRequestPayload({ ...base, locale: 'nl' });
    const en = await redemptionRequestPayload({ ...base, locale: 'en' });
    expect(nl.url).toBe('/nl/rewards');
    expect(en.url).toBe('/en/rewards');
  });
});
