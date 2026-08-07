import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * This design system's font-size scale, exactly as declared by the
 * `--text-*` custom properties in `globals.css`.
 *
 * It has to be repeated here because `tailwind-merge` resolves conflicts from a
 * static class map, not from the stylesheet. Left unregistered, every one of
 * these is an *unknown* `text-*` utility, and tailwind-merge's fallback is to
 * assume an unknown `text-*` is a **colour** — which puts `text-caption` and
 * `text-cat-blue-fg` in the same conflict group and silently drops whichever
 * came first. That is a real bug that shipped twice (M16 found it in the
 * agenda gutter, M17 in `EventChip`) and it is invisible: the class is in the
 * source, absent from the DOM, and the element merely renders at the inherited
 * size in the right colour, or the right size in the inherited colour.
 *
 * Registering the scale is the fix at the root. A `text-*` size and a `text-*`
 * colour now belong to different groups, so both survive `cn()` — no call site
 * has to know about the hazard, and the next token added to `globals.css` only
 * has to be added here too (asserted by a unit test that reads the stylesheet).
 */
export const FONT_SIZE_TOKENS = [
  'display-hub',
  'display-xl',
  'display-lg',
  'display-md',
  'h1',
  'h2',
  'h3',
  'body-lg',
  'body',
  'body-sm',
  'caption',
  'overline',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZE_TOKENS] }],
    },
  },
});

/** Conditional class merging with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
