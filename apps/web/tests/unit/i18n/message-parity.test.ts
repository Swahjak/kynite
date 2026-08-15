import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * M15: `messages/nl.json` and `messages/en.json` must have **identical key
 * trees**. Namespace-scoped tests (board-voice, notification voice, …) each
 * assert their own slice is non-empty and voice-clean, but nothing before
 * this test walked the *whole* tree and failed on a key present in one
 * locale and missing (or orphaned) in the other — a translator adding a key
 * to only one file, or a rename that misses one side, would otherwise ship
 * silently and only surface as a runtime `MISSING_MESSAGE` in the other
 * locale.
 *
 * The check is structural (key paths), not content (a shared value like a
 * proper noun is fine); leaf *type* mismatches (e.g. a string in one locale
 * and an object in the other) are treated as both-missing on both sides,
 * since a next-intl consumer would break either way.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

function isPlainObject(node: Json): node is { [key: string]: Json } {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

/** Every leaf key path in dotted notation, e.g. `nav.today`, `rewards.store.title`. */
function leafPaths(node: Json, path = '', out: Set<string> = new Set()): Set<string> {
  if (isPlainObject(node)) {
    const keys = Object.keys(node);
    if (keys.length === 0) out.add(path); // an empty object is itself a leaf
    for (const key of keys) leafPaths(node[key], path ? `${path}.${key}` : key, out);
  } else {
    out.add(path);
  }
  return out;
}

function loadMessages(locale: 'nl' | 'en'): Record<string, Json> {
  return JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'));
}

describe('nl.json and en.json have identical key trees', () => {
  const nl = loadMessages('nl');
  const en = loadMessages('en');
  const nlKeys = leafPaths(nl);
  const enKeys = leafPaths(en);

  it('scans a substantial, non-empty message tree (a scan of nothing always passes)', () => {
    expect(nlKeys.size).toBeGreaterThan(100);
    expect(enKeys.size).toBeGreaterThan(100);
  });

  it('has no key present in nl but missing from en', () => {
    const missingFromEn = [...nlKeys].filter((key) => !enKeys.has(key)).sort();
    expect(missingFromEn).toEqual([]);
  });

  it('has no key present in en but orphaned (absent) from nl', () => {
    const missingFromNl = [...enKeys].filter((key) => !nlKeys.has(key)).sort();
    expect(missingFromNl).toEqual([]);
  });

  it('has no leaf whose value is an empty string in either locale', () => {
    // An empty translation is indistinguishable from a key nobody filled in
    // yet — it should never reach the tree in the first place.
    const emptyIn = (messages: Record<string, Json>, path: string): boolean => {
      const parts = path.split('.');
      let node: Json = messages;
      for (const part of parts) {
        if (!isPlainObject(node)) return false;
        node = node[part];
      }
      return node === '';
    };

    const emptyNl = [...nlKeys].filter((key) => emptyIn(nl, key));
    const emptyEn = [...enKeys].filter((key) => emptyIn(en, key));
    expect({ emptyNl, emptyEn }).toEqual({ emptyNl: [], emptyEn: [] });
  });

  it('catches a missing key it exists to prevent (fixture, non-vacuity)', () => {
    const a = leafPaths({ nav: { today: 'Vandaag', calendar: 'Agenda' } });
    const b = leafPaths({ nav: { today: 'Today' } });
    const missingFromB = [...a].filter((key) => !b.has(key));
    const missingFromA = [...b].filter((key) => !a.has(key));
    expect(missingFromB).toEqual(['nav.calendar']);
    expect(missingFromA).toEqual([]);
  });
});
