import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The design system allows exactly four radii — 4px fields, 8px rows and
 * anything nested inside a card, 16px cards/panels/sheets/modals, and the pill.
 * "A card never uses 20, 24 or 32."
 *
 * Two things can break that rule, and both are asserted here:
 *  1. a *token* drifting off the four-step scale, and
 *  2. a *call site* smuggling a one-off in through a Tailwind arbitrary value.
 *
 * The one deliberate exception is the confetti particle, which is a 6px scrap
 * of paper rather than a product surface.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = resolve(webRoot, '../..');
const uiRoot = resolve(repoRoot, 'packages/ui');
const tokensPath = resolve(uiRoot, 'src/styles/tokens.css');

/** 4px, 8px, 16px, pill. Nothing else. */
const ALLOWED_RADII = new Set(['0.25rem', '0.5rem', '1rem', '9999px']);

const SOURCE_TREES = [resolve(webRoot, 'src'), resolve(uiRoot, 'src')];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.css', '.js', '.jsx', '.mjs'];

/** The single sanctioned arbitrary radius, and why. */
const CONFETTI_PARTICLE = 'packages/ui/src/components/confetti-burst.tsx';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

describe('radius scale', () => {
  it('defines only the four allowed radii', () => {
    const css = readFileSync(tokensPath, 'utf8');
    const declarations = [...css.matchAll(/^\s*(--radius(?:-[\w-]+)?)\s*:\s*([^;]+);/gm)].map(
      ([, name, value]) => [name, value.trim()] as const
    );

    // Guard against the regex silently matching nothing.
    expect(declarations.length).toBeGreaterThanOrEqual(8);

    const offenders = declarations.filter(([, value]) => !ALLOWED_RADII.has(value));
    expect(offenders).toEqual([]);
  });

  it('has no arbitrary `rounded-[…]` outside the confetti particle', () => {
    const pattern = /rounded(?:-[a-z]+)?-\[/;

    const offenders = SOURCE_TREES.flatMap(walk)
      .flatMap((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .map((line, index) => ({ file, line: index + 1, text: line }))
          .filter(({ text }) => pattern.test(text))
      )
      .filter(({ file }) => relative(repoRoot, file) !== CONFETTI_PARTICLE)
      .map(({ file, line }) => `${relative(repoRoot, file)}:${line}`);

    expect(offenders).toEqual([]);
  });
});
