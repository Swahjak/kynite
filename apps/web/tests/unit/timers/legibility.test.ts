import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  COUNTDOWN_DIGIT_CLASS,
  COUNTDOWN_DIGIT_CLASS_COMPACT,
  TIMER_TAP_TARGET_CLASS,
} from '@/modules/timers/ui/tokens';

/**
 * M09's six-foot legibility claim, held as a test rather than as a screenshot
 * caption: the countdown digits are **tabular** and at **Display M scale or
 * larger**, on both the timers screen and the ambient board.
 *
 * The sizes are read out of the design system rather than hard-coded here, so
 * retuning the type scale cannot silently shrink a countdown below the
 * threshold — it fails here instead.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
/**
 * The design system, as shipped: the type scale lives in `tokens.css` and the
 * `.tabular-time` utility in `utilities.css` (both in `@kynite/ui` since phase
 * 2, both pulled in by one `@import` in the app). This test asserts across the
 * pair, so it reads the pair.
 */
const css = ['tokens.css', 'utilities.css']
  .map((file) => readFileSync(join(root, '../../packages/ui/src/styles', file), 'utf8'))
  .join('\n');

/** `--text-display-md: 2.25rem;` → 2.25 */
function remOf(token: string): number {
  const match = new RegExp(`--text-${token}:\\s*([\\d.]+)rem`).exec(css);
  expect(match, `--text-${token} must exist in the design system`).not.toBeNull();
  return Number(match![1]);
}

function sizeTokenIn(className: string): string {
  const match = /\btext-(display-[a-z]+)\b/.exec(className);
  expect(match, `${className} must carry a Display-scale size`).not.toBeNull();
  return match![1];
}

describe('countdown legibility', () => {
  const displayM = remOf('display-md');

  it('renders the digits with tabular numerals', () => {
    // `tabular-time` is the design-system utility that sets
    // `font-variant-numeric: tabular-nums` (globals.css) — without it the
    // digits reflow on every tick.
    expect(COUNTDOWN_DIGIT_CLASS).toContain('tabular-time');
    expect(COUNTDOWN_DIGIT_CLASS_COMPACT).toContain('tabular-time');
    expect(css).toMatch(/@utility tabular-time \{[\s\S]*?font-variant-numeric: tabular-nums/);
  });

  it('sets both countdowns at Display M scale or larger', () => {
    expect(remOf(sizeTokenIn(COUNTDOWN_DIGIT_CLASS))).toBeGreaterThanOrEqual(displayM);
    expect(remOf(sizeTokenIn(COUNTDOWN_DIGIT_CLASS_COMPACT))).toBeGreaterThanOrEqual(displayM);
    // The full-screen board is larger than the ambient strip, not equal to it.
    expect(remOf(sizeTokenIn(COUNTDOWN_DIGIT_CLASS))).toBeGreaterThan(
      remOf(sizeTokenIn(COUNTDOWN_DIGIT_CLASS_COMPACT))
    );
  });

  it('keeps no `text-` colour behind the size — tailwind-merge would drop it', () => {
    // The failure this pins actually happened: `cn('text-display-xl
    // text-foreground')` merged down to `text-foreground` and the countdown
    // rendered at body size.
    for (const className of [COUNTDOWN_DIGIT_CLASS, COUNTDOWN_DIGIT_CLASS_COMPACT]) {
      const colours = className
        .split(/\s+/)
        .filter((token) => token.startsWith('text-') && !token.startsWith('text-display-'));
      expect(colours).toEqual([]);
    }
  });

  it('keeps every timer control at the 48px kiosk minimum', () => {
    expect(TIMER_TAP_TARGET_CLASS).toContain('min-h-12');
  });
});
