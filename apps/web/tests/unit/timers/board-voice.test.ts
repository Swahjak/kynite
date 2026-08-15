import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STRICT_RULES, scanVoice, stringsIn } from '../i18n/board-voice-rules';

/**
 * PRD FR30, applied to the timer copy: **the board speaks for itself.**
 *
 * A countdown is the single most tempting place in this product to write a
 * parent's voice — "put your shoes on!", "you have 5 minutes left" — and the
 * research is explicit that the device stops working the moment it becomes the
 * parent's mouthpiece (§"Nagging / device as messenger"). So the rule is a
 * scan, not a review note: no second-person pronoun, no imperative aimed at a
 * person, no exclamation mark, anywhere under `timers` in either locale.
 *
 * "Schoenen aan over 5 minuten" passes. "Doe je schoenen aan!" fails three
 * different rules, which is the point.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// M15: the rule table and the tree-walk/scan functions now live in
// `../i18n/board-voice-rules` (shared with the hub-wide checklist test and
// available to the notification voice test), so this file keeps only the
// timers-specific wiring. `scanBoardVoice` is kept as a local alias so the
// rest of this file — and its narrative comments about what it catches —
// reads unchanged.
const scanBoardVoice = (locale: 'nl' | 'en', strings: readonly [string, string][]) =>
  scanVoice(STRICT_RULES, locale, strings);

function messages(locale: 'nl' | 'en'): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'));
}

describe('timer copy is board voice, never a parent talking', () => {
  for (const locale of ['nl', 'en'] as const) {
    const strings = stringsIn(messages(locale).timers, 'timers');

    it(`scans a non-empty ${locale} timer namespace (a scan of nothing always passes)`, () => {
      expect(strings.length).toBeGreaterThanOrEqual(20);
      expect(strings.map(([path]) => path)).toContain('timers.warning');
      expect(strings.map(([path]) => path)).toContain('timers.overrun');
    });

    it(`finds no second-person address, command or shouting in ${locale}`, () => {
      expect(scanBoardVoice(locale, strings)).toEqual([]);
    });
  }

  it('catches the parental phrasings it exists to prevent (fixture)', () => {
    const nl = scanBoardVoice('nl', [
      ['timers.warning', 'Doe je schoenen aan!'],
      ['timers.overrun', 'Je bent te laat.'],
      ['timers.ok', 'Schoenen aan over 5 minuten'],
    ]);

    expect(nl.map((finding) => finding.rule).sort()).toEqual([
      'imperative',
      'second-person',
      'second-person',
      'shouting',
    ]);
    expect(nl.map((finding) => finding.path)).not.toContain('timers.ok');

    const en = scanBoardVoice('en', [
      ['timers.warning', 'Put your shoes on!'],
      ['timers.ok', 'Shoes on in 5 minutes'],
    ]);

    expect(new Set(en.map((finding) => finding.rule))).toEqual(
      new Set(['imperative', 'second-person', 'shouting'])
    );
    expect(en.map((finding) => finding.path)).not.toContain('timers.ok');
  });

  it('keeps both locales at exactly the same key set', () => {
    const keys = (locale: 'nl' | 'en') =>
      stringsIn(messages(locale).timers, 'timers')
        .map(([path]) => path)
        .sort();

    expect(keys('nl')).toEqual(keys('en'));
  });
});
