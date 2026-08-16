import { describe, expect, it } from 'vitest';
import {
  FEED_PRESETS,
  addWarnings,
  checkPresetUrl,
  findPreset,
  type FeedPreset,
} from '@/modules/ics/domain/presets';
import { checkFeedUrl } from '@/modules/ics/domain/url';

/**
 * The guided-add catalogue (M25b).
 *
 * Three things are worth a test here and the rest is copy: that a preset's URL
 * rule accepts the shape the vendor actually hands a parent and refuses the
 * half-copied one, that a preset with a fixed URL passes the SSRF guard
 * unchanged, and that the add-time warnings fire on the two states a green tick
 * would otherwise hide.
 *
 * Every token below is fake. A real Social Schools link is a bearer credential
 * for a school's agenda, so one must never enter a fixture, a story or a
 * commit — see the note on `redactFeedUrl`.
 */

const SOCIAL_SCHOOLS =
  'https://api.socialschools.eu/api/v1/icalfeed/?schoolId=42&roleTypeId=3' +
  '&userId=00000000-0000-4000-8000-000000000000&hash=faketoken0000000';

function preset(key: string): FeedPreset {
  const found = findPreset(key);
  expect(found, `preset ${key} is missing`).not.toBeNull();
  return found as FeedPreset;
}

describe('FEED_PRESETS', () => {
  it('ships the two verified basisschool platforms', () => {
    const keys = FEED_PRESETS.map((entry) => entry.key);

    expect(keys).toContain('socialSchools');
    expect(keys).toContain('parro');
  });

  it('ships no preset for a platform whose domain is dead', () => {
    const keys = FEED_PRESETS.map((entry) => entry.key as string);

    expect(keys).not.toContain('klasbord');
    expect(keys).not.toContain('schoudercom');
  });

  it('ships no national holiday feed — `modules/holidays` already draws those', () => {
    // A "Feestdagen in Nederland" subscription would put a second Koningsdag
    // next to the one `modules/calendar/domain/holidays.ts` computes, and the
    // Rijksoverheid vakantie source is JSON rather than ICS. See the file's
    // docblock: the real gap is the regio/horizon of that table, not a feed.
    const keys = FEED_PRESETS.map((entry) => entry.key as string);

    expect(keys).not.toContain('feestdagen');
    expect(keys).not.toContain('rijksoverheid');
  });

  it('marks the voortgezet-onderwijs platforms as such', () => {
    for (const key of ['magister', 'somtoday', 'zermelo']) {
      expect(preset(key).level, key).toBe('vo');
    }
    expect(preset('socialSchools').level).toBe('po');
  });

  it('has a unique key per preset', () => {
    expect(new Set(FEED_PRESETS.map((entry) => entry.key)).size).toBe(FEED_PRESETS.length);
  });

  it('gives every preset a default event type so its events inherit one', () => {
    for (const entry of FEED_PRESETS) {
      expect(entry.defaultType, entry.key).toBeTruthy();
    }
  });
});

describe('findPreset', () => {
  it('returns null for an unknown, empty or absent id', () => {
    expect(findPreset('klasbord')).toBeNull();
    expect(findPreset('')).toBeNull();
    expect(findPreset(null)).toBeNull();
    expect(findPreset(undefined)).toBeNull();
  });
});

describe('checkPresetUrl — Social Schools', () => {
  const socialSchools = () => preset('socialSchools');

  it('accepts the shape the vendor actually hands out', () => {
    const checked = checkFeedUrl(SOCIAL_SCHOOLS);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({ ok: true });
  });

  it('accepts it through the webcal:// rewrite, which is what a parent pastes', () => {
    const checked = checkFeedUrl(SOCIAL_SCHOOLS.replace('https:', 'webcal:'));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checked.url.protocol).toBe('https:');
    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({ ok: true });
  });

  it('refuses a link from another host entirely', () => {
    const checked = checkFeedUrl('https://school.example/agenda.ics');
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({
      ok: false,
      error: 'presetHost',
    });
  });

  it('refuses the right host with the wrong endpoint', () => {
    const checked = checkFeedUrl('https://api.socialschools.eu/api/v1/messages/?schoolId=42');
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({
      ok: false,
      error: 'presetHost',
    });
  });

  it('refuses a half-copied link that lost its token', () => {
    const truncated = 'https://api.socialschools.eu/api/v1/icalfeed/?schoolId=42&roleTypeId=3';
    const checked = checkFeedUrl(truncated);
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({
      ok: false,
      error: 'presetIncomplete',
    });
  });

  it('refuses a token-shaped parameter that is empty', () => {
    const checked = checkFeedUrl(SOCIAL_SCHOOLS.replace('faketoken0000000', ''));
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(socialSchools(), checked.url)).toEqual({
      ok: false,
      error: 'presetIncomplete',
    });
  });
});

describe('checkPresetUrl — presets without a documented URL shape', () => {
  it('accepts any https link for Parro, whose URL format the vendor never publishes', () => {
    const checked = checkFeedUrl('https://talk.parro.com/whatever/they/hand/out.ics');
    expect(checked.ok).toBe(true);
    if (!checked.ok) return;

    expect(checkPresetUrl(preset('parro'), checked.url)).toEqual({ ok: true });
  });
});

describe('preset help links', () => {
  it('points at https vendor documentation, never at a feed URL', () => {
    for (const entry of FEED_PRESETS) {
      if (!entry.helpUrl) continue;
      expect(new URL(entry.helpUrl).protocol, entry.key).toBe('https:');
      // A help link is public; a feed link is a credential. They must never be
      // the same field.
      expect(new URL(entry.helpUrl).search, entry.key).toBe('');
    }
  });
});

describe('addWarnings', () => {
  it('says nothing when a feed arrives with events and is the first of its kind', () => {
    expect(addWarnings({ eventCount: 12, presetAlreadySubscribed: false })).toEqual([]);
  });

  it('warns when a feed loaded but contained no events at all', () => {
    // The dead schoolvakanties feeds return a valid, event-free VCALENDAR that
    // `looksLikeCalendar` accepts — a green tick over an empty calendar.
    expect(addWarnings({ eventCount: 0, presetAlreadySubscribed: false })).toEqual(['emptyFeed']);
  });

  it('warns when this household already follows the same platform', () => {
    expect(addWarnings({ eventCount: 20, presetAlreadySubscribed: true })).toEqual([
      'presetAlreadyAdded',
    ]);
  });

  it('reports both when both are true', () => {
    expect(addWarnings({ eventCount: 0, presetAlreadySubscribed: true })).toEqual([
      'emptyFeed',
      'presetAlreadyAdded',
    ]);
  });
});
