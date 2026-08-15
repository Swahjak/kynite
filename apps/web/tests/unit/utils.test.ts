import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cn, FONT_SIZE_TOKENS } from '@kynite/ui';

describe('cn()', () => {
  it('joins class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    const enabled = false;
    expect(cn('a', enabled && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('resolves conflicting Tailwind utilities, last one wins', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-green-500')).toBe('text-green-500');
  });

  it('supports conditional object and array syntax', () => {
    expect(cn(['a', { b: true, c: false }])).toBe('a b');
  });
});

/**
 * The bug this guards against shipped twice before it was understood (M16:
 * agenda gutter; M17: `EventChip`). An unregistered `text-caption` looks like a
 * colour to tailwind-merge, so putting it next to a real colour silently drops
 * one of the two — in the source, absent from the DOM, no error anywhere.
 */
describe('cn() and the design system font-size scale', () => {
  for (const token of FONT_SIZE_TOKENS) {
    it(`keeps text-${token} and a colour together, in both orders`, () => {
      expect(cn(`text-${token}`, 'text-cat-blue-fg')).toBe(`text-${token} text-cat-blue-fg`);
      expect(cn('text-cat-blue-fg', `text-${token}`)).toBe(`text-cat-blue-fg text-${token}`);
    });
  }

  it('still lets one size override another', () => {
    expect(cn('text-body', 'text-h1')).toBe('text-h1');
  });

  it('still lets one colour override another', () => {
    expect(cn('text-ink-muted', 'text-brand-ink')).toBe('text-brand-ink');
  });

  it('registers every --text-* token declared in the design tokens', () => {
    const css = readFileSync(
      new URL('../../../../packages/ui/src/styles/tokens.css', import.meta.url),
      'utf8'
    );
    // Size declarations only: the `--text-x--line-height` / `--font-weight` /
    // `--letter-spacing` companions are not utilities.
    // Tailwind's own scale is already in tailwind-merge's class map; only the
    // brand tokens have to be taught. The hub block redeclares `--text-sm` etc.
    // at kiosk sizes, which changes their value, not their name.
    const tailwindOwn = new Set([
      'xs',
      'sm',
      'base',
      'lg',
      'xl',
      '2xl',
      '3xl',
      '4xl',
      '5xl',
      '6xl',
      '7xl',
      '8xl',
      '9xl',
    ]);

    const declared = new Set(
      [...css.matchAll(/^\s*--text-([a-z0-9-]+):\s/gm)]
        .map((match) => match[1])
        .filter((name) => !name.includes('--') && !tailwindOwn.has(name))
    );

    expect([...declared].sort()).toEqual([...FONT_SIZE_TOKENS].sort());
  });
});
