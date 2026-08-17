import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Border and ring *widths*, the way `radius-scale.test.ts` guards radii.
 *
 * The design system allows three widths and no others:
 *
 *   1px  the hairline — every border that separates a surface from what is
 *        behind it, plus the secondary button's outline.
 *   2px  the emphasis width, and it has exactly three jobs the spec names:
 *        the input's bottom rule, the avatar's surface ring, and the "Wie"
 *        filter's selected indigo ring.
 *   3px  the focus ring, and only the focus ring.
 *
 * Two things can break that, and both are asserted here:
 *  1. a call site smuggling a one-off through a Tailwind arbitrary value, and
 *  2. the focus affordance drifting into a second spelling — this codebase had
 *     four (`ring-3`, `ring-[3px]`, `ring-2`, `outline-2`) before this pass,
 *     which meant the same keyboard focus looked different on four screens.
 *
 * `ring-2` survives where it is NOT a focus ring: the avatar overlap ring and
 * the "Wie" filter's selected state are 2px design elements per the spec, so
 * the focus assertion below deliberately only looks at `focus-visible:` uses.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = resolve(webRoot, '../..');
const uiRoot = resolve(repoRoot, 'packages/ui');
const tokensPath = resolve(uiRoot, 'src/styles/tokens.css');

const SOURCE_TREES = [resolve(webRoot, 'src'), resolve(uiRoot, 'src')];
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.css', '.js', '.jsx', '.mjs'];

/** The single sanctioned focus affordance. */
const FOCUS_SPELLING = 'focus-visible:ring-3';

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
    return SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

function offenders(pattern: RegExp): string[] {
  return SOURCE_TREES.flatMap(walk).flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .flatMap((text, index) => {
        const hits = text.match(pattern);
        return hits
          ? [`${relative(repoRoot, file)}:${index + 1} — ${[...new Set(hits)].join(' ')}`]
          : [];
      })
  );
}

describe('border + ring widths', () => {
  it('has no arbitrary `border-[…]` or `ring-[…]` widths', () => {
    expect(offenders(/(?:border|ring|outline)-\[[^\]]*\]/g)).toEqual([]);
  });

  it('spells the focus affordance exactly one way', () => {
    // Every `focus-visible:` width token in either tree, whichever property it
    // sets. There must be one distinct spelling and it must be `ring-3`.
    const found = offenders(/focus-visible:(?:ring|outline)-(?:\d+|\[[^\]]*\])(?![\w-])/g);
    const spellings = new Set(
      found.flatMap((line) => line.split(' — ')[1]?.split(' ') ?? []).filter(Boolean)
    );
    expect([...spellings].sort()).toEqual([FOCUS_SPELLING]);
  });

  it('declares the three border-width tokens', () => {
    const css = readFileSync(tokensPath, 'utf8');
    const declared = Object.fromEntries(
      [...css.matchAll(/^\s*(--(?:border|ring)-width-[\w-]+)\s*:\s*([^;]+);/gm)].map(
        ([, name, value]) => [name, value.trim()]
      )
    );

    expect(declared).toEqual({
      '--border-width-hairline': '1px',
      '--border-width-emphasis': '2px',
      '--ring-width-focus': '3px',
    });
  });
});
