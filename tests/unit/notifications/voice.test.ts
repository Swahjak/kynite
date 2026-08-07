import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Push and offline copy is board copy (PRD FR30; research §"Nagging / device
 * as messenger": "the device became the reminder source"; §Decisions 12
 * "Voice/tone rule: the hub is a neutral board, never a parent's mouthpiece").
 *
 * A notification is the one Kynite surface that arrives *uninvited*, on a
 * lock screen, while somebody is doing something else. It is therefore the
 * surface where a parental imperative would land hardest — "don't forget the
 * shoes!" from a phone is precisely the nagging the research says breeds
 * resistance, only now delivered by software that cannot read the room.
 *
 * So the rule is enforced, not reviewed: a scan over the `notifications` and
 * `offline` message trees in both locales.
 *
 * The positive form of the rule is a *statement of schedule* — "Schoenen aan
 * over 5 minuten" — which is asserted at the bottom.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const LOCALES = ['nl', 'en'] as const;

type Rule = { id: string; pattern: RegExp; why: string };

const RULES: Rule[] = [
  {
    id: 'parent-attribution',
    // "mama zegt", "papa says", "your mother wants" — the device speaking for
    // a person is exactly what FR30 forbids.
    pattern: /\b(?:mama|papa|mamma|pappa|mom|mum|mother|father|dad)\b/i,
    why: 'the board never speaks for a parent (FR30)',
  },
  {
    id: 'nagging-imperative',
    pattern:
      /\b(?:don'?t forget|vergeet niet|niet vergeten|hurry|schiet op|opschieten|come on|kom op|now!|nu!)\b/i,
    why: 'a reminder states the schedule; it does not chase anyone',
  },
  {
    id: 'guilt-framing',
    pattern:
      /\b(?:still (?:not|haven'?t)|nog steeds niet|again|alweer|weer niet|you forgot|je bent vergeten|te laat|too late|overdue|achterstand)\b/i,
    why: 'a missed task is the absence of a row, never a reproach (§Decisions 1)',
  },
  {
    id: 'failure-vocabulary',
    pattern: /\b(?:failed|mislukt|error!|fout!|niet gehaald|missed|gemist)\b/i,
    why: 'nothing in this product reports a person as having failed',
  },
  {
    id: 'exclamatory-urgency',
    // One exclamation mark in a notification body reads as raised voice.
    pattern: /!{1,}/,
    why: 'notifications are ambient information, not alarms',
  },
];

function stringsIn(value: unknown, path: string[] = []): { key: string; text: string }[] {
  if (typeof value === 'string') return [{ key: path.join('.'), text: value }];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => stringsIn(child, [...path, key]));
  }
  return [];
}

function messagesFor(locale: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8')) as Record<
    string,
    unknown
  >;
}

/** Exported so the rule set can be mutation-tested against a synthetic tree. */
export function scanVoice(
  entries: readonly { key: string; text: string }[]
): { key: string; rule: string; text: string }[] {
  return entries.flatMap(({ key, text }) =>
    RULES.flatMap((rule) => (rule.pattern.test(text) ? [{ key, rule: rule.id, text }] : []))
  );
}

describe('notification and offline copy is neutral board voice', () => {
  for (const locale of LOCALES) {
    it(`${locale}: no parental, nagging or guilt framing`, () => {
      const messages = messagesFor(locale);
      const entries = [
        ...stringsIn(messages.notifications, ['notifications']),
        ...stringsIn(messages.offline, ['offline']),
      ];

      // Guard against the scan silently covering nothing.
      expect(entries.length).toBeGreaterThan(10);
      expect(scanVoice(entries)).toEqual([]);
    });
  }

  it('catches the phrasings it claims to catch', () => {
    // Mutation check: without this the suite above would pass on an empty
    // rule set just as happily.
    const findings = scanVoice([
      { key: 'a', text: 'Mama zegt: schoenen aan' },
      { key: 'b', text: "Don't forget your shoes" },
      { key: 'c', text: 'Je bent alweer te laat' },
      { key: 'd', text: 'Shoes on now!' },
    ]);

    expect(findings.map((finding) => finding.rule).sort()).toEqual(
      ['exclamatory-urgency', 'guilt-framing', 'nagging-imperative', 'parent-attribution'].sort()
    );
  });

  it('states the schedule rather than issuing an instruction', () => {
    const nl = messagesFor('nl') as {
      notifications: { reminder: { soon: string; now: string } };
    };

    // The FR7/§Decisions-12 shape: "<what> over <n> minuten" — a fact about
    // the board, with the routine's own title as the subject.
    expect(nl.notifications.reminder.soon).toMatch(/\{title\}.*over.*\{minutes\}/);
    // No second person anywhere: not "jij", not "je moet".
    expect(nl.notifications.reminder.soon).not.toMatch(/\bje\b|\bjij\b|\bjouw\b/i);
    expect(nl.notifications.reminder.now).not.toMatch(/\bje\b|\bjij\b|\bjouw\b/i);
  });

  it('keeps the two locales structurally identical', () => {
    const keysOf = (locale: string) =>
      stringsIn(messagesFor(locale).notifications, ['notifications'])
        .map((entry) => entry.key)
        .sort();

    expect(keysOf('nl')).toEqual(keysOf('en'));
  });
});
