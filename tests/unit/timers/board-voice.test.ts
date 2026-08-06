import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

type Rule = { id: string; pattern: RegExp };

const RULES: Record<'nl' | 'en', Rule[]> = {
  nl: [
    {
      id: 'second-person',
      pattern: /\b(?:je|jij|jou|jouw|jullie|u|uw)\b/i,
    },
    {
      // The stem-form imperative a parent uses: "Doe …", "Ga …", "Pak …".
      // Infinitive button labels ("Stoppen", "Starten") are unaffected.
      id: 'imperative',
      pattern: /(?:^|[.!?]\s+)(?:doe|ga|pak|kom|zet|trek|schiet|stop|start|maak|ruim)\b/i,
    },
    { id: 'shouting', pattern: /!/ },
  ],
  en: [
    { id: 'second-person', pattern: /\b(?:you|your|yours|yourself)\b/i },
    {
      id: 'imperative',
      pattern: /(?:^|[.!?]\s+)(?:put|get|go|come|hurry|finish|clean|brush|pick)\b/i,
    },
    { id: 'shouting', pattern: /!/ },
  ],
};

export type VoiceFinding = { path: string; rule: string; text: string };

/** Every string under a message subtree, with its dotted key path. */
function stringsIn(node: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof node === 'string') {
    out.push([path, node]);
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) stringsIn(value, `${path}.${key}`, out);
  }
  return out;
}

export function scanBoardVoice(
  locale: 'nl' | 'en',
  strings: readonly [string, string][]
): VoiceFinding[] {
  return strings.flatMap(([path, text]) =>
    RULES[locale].flatMap((rule) =>
      rule.pattern.test(text) ? [{ path, rule: rule.id, text }] : []
    )
  );
}

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
