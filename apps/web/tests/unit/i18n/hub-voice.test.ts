import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HUB_RULES, scanVoice, stringsIn, type VoiceFinding } from './board-voice-rules';

/**
 * M15: PRD FR30 applies to *every* hub-facing surface, not just timers
 * (`tests/unit/timers/board-voice.test.ts`) and notifications
 * (`tests/unit/notifications/voice.test.ts`), which already have their own
 * scans. This test is the copy-review checklist for the rest of the hub:
 * the ambient today board, the routines board, the reward store, and the
 * stars chart — the four screens a wall-mounted tablet actually shows.
 *
 * Unlike the timers/notifications scans, this one allows bare second-person
 * address ("Je hebt doorgezet!" / "You kept going!") — praise spoken to the
 * child is not a parent's mouthpiece, it is the board celebrating what the
 * child did. What FR30 actually forbids — a command with implied parental
 * authority ("Doe je schoenen aan"), attribution to "mama"/"papa", or guilt
 * framing over a missed task — is what `HUB_RULES` checks.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function messages(locale: 'nl' | 'en'): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'));
}

function get(node: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, node);
}

/**
 * The hub-facing subtree of each namespace — deliberately excludes
 * parent-authoring surfaces (`routines.dialog`, `routines.form`,
 * `rewards.dialog`, `rewards.form`, `rewards.queue`, …), which are Controller
 * UI addressed to the parent and out of FR30's scope by design.
 */
const HUB_SUBTREES: readonly { namespace: string; path: string }[] = [
  { namespace: 'calendar', path: 'calendar.hub' },
  { namespace: 'routines', path: 'routines.hub' },
  { namespace: 'routines', path: 'routines.praise' },
  { namespace: 'routines', path: 'routines.boardEmpty' },
  { namespace: 'routines', path: 'routines.sectionEmpty' },
  { namespace: 'routines', path: 'routines.sectionProgress' },
  { namespace: 'routines', path: 'routines.stepCount' },
  { namespace: 'routines', path: 'routines.inProgress' },
  { namespace: 'routines', path: 'routines.startsIn' },
  { namespace: 'routines', path: 'routines.startsInHours' },
  { namespace: 'routines', path: 'routines.starsEarned' },
  { namespace: 'routines', path: 'routines.completeStep' },
  { namespace: 'routines', path: 'routines.routineDone' },
  { namespace: 'rewards', path: 'rewards.store' },
  { namespace: 'rewards', path: 'rewards.chart' },
  // M19: the kiosk's own chrome — the rail, the per-child launcher on the
  // board and the child's screen switcher. It is the first copy a child reads
  // on the wall, so it is scanned with everything else rather than being
  // exempt for being "navigation".
  { namespace: 'hub', path: 'hub' },
];

function collect(locale: 'nl' | 'en'): [string, string][] {
  const m = messages(locale);
  return HUB_SUBTREES.flatMap(({ path }) => stringsIn(get(m, path), path));
}

describe('hub-facing copy is neutral board voice in both locales (FR30)', () => {
  for (const locale of ['nl', 'en'] as const) {
    const strings = collect(locale);

    it(`scans a non-empty ${locale} hub copy set (a scan of nothing always passes)`, () => {
      expect(strings.length).toBeGreaterThanOrEqual(20);
      expect(strings.map(([path]) => path)).toContain(`calendar.hub.unpairedTitle`);
      expect(strings.map(([path]) => path)).toContain(`rewards.store.title`);
      expect(strings.map(([path]) => path)).toContain(`rewards.chart.title`);
    });

    it(`finds no parent-attribution, imperative command or guilt-framing in ${locale}`, () => {
      const findings = scanVoice(HUB_RULES, locale, strings);
      expect(findings).toEqual([]);
    });
  }

  it('catches the parental phrasings it exists to prevent (fixture, non-vacuity)', () => {
    const nl: VoiceFinding[] = scanVoice(HUB_RULES, 'nl', [
      ['fixture.a', 'Doe je schoenen aan.'],
      ['fixture.b', 'Mama zegt dat het klaar is.'],
      ['fixture.c', 'Je bent het weer vergeten.'],
      ['fixture.ok', 'Alles klaar, Mila!'],
      ['fixture.praise', 'Je hebt doorgezet!'],
    ]);

    expect(new Set(nl.map((finding) => finding.rule))).toEqual(
      new Set(['imperative', 'parent-attribution', 'guilt-framing'])
    );
    expect(nl.map((finding) => finding.path)).not.toContain('fixture.ok');
    // Second-person praise addressed to the child is allowed under HUB_RULES.
    expect(nl.map((finding) => finding.path)).not.toContain('fixture.praise');

    const en: VoiceFinding[] = scanVoice(HUB_RULES, 'en', [
      ['fixture.a', 'Put your shoes on.'],
      ['fixture.b', 'Mom says it is time.'],
      ['fixture.c', 'You forgot again.'],
      ['fixture.ok', 'All done, Mila!'],
      ['fixture.praise', 'You kept going!'],
    ]);

    expect(new Set(en.map((finding) => finding.rule))).toEqual(
      new Set(['imperative', 'parent-attribution', 'guilt-framing'])
    );
    expect(en.map((finding) => finding.path)).not.toContain('fixture.ok');
    expect(en.map((finding) => finding.path)).not.toContain('fixture.praise');
  });

  it('keeps both locales at exactly the same hub-copy key set', () => {
    const keys = (locale: 'nl' | 'en') =>
      collect(locale)
        .map(([path]) => path)
        .sort();
    expect(keys('nl')).toEqual(keys('en'));
  });
});
