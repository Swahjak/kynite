import { OVERRUN_PULSE_MS } from '../domain/chime';

/**
 * Presentation constants for the timer surfaces.
 *
 * The two numbers that matter are here rather than inline in JSX because they
 * are both *claims* the milestone makes and tests check: the countdown is at
 * Display scale for six-foot legibility, and the expired state breathes rather
 * than flashes.
 */

/**
 * The countdown digits. `tabular-time` is the design-system utility that sets
 * `font-variant-numeric: tabular-nums` on Hanken Grotesk (globals.css) — without it
 * every tick reflows as the glyph widths change, which at this size is the
 * most distracting thing on a wall.
 *
 * `text-display-xl` (5rem) is two steps above the Display M minimum the
 * milestone sets, which is what six feet actually needs.
 */
/*
 * No `text-foreground` alongside the size: `cn()` runs tailwind-merge, which
 * does not know `text-display-xl` is a *size* in this theme and drops it as a
 * conflicting `text-` colour utility. The default colour is `foreground`
 * anyway (globals.css `body`), so the class is nothing but a trap.
 */
/*
 * M19: `text-display-hub` (72px) on a phone, stepping to `text-display-xl`
 * (80px) from `sm` up. The hub token is the mockups' own "one huge number on a
 * screen" size (`kynite_design_system_spec.txt`), and at 390px an 80px `1:04:30`
 * overflows the tile — 72px is the largest that does not. Both are far above
 * the Display M floor `tests/unit/timers/legibility.test.ts` holds.
 */
export const COUNTDOWN_DIGIT_CLASS =
  'tabular-time font-extrabold text-display-hub sm:text-display-xl leading-none';

/** The ambient board's smaller countdown — still Display scale (2.25rem). */
export const COUNTDOWN_DIGIT_CLASS_COMPACT =
  'tabular-time font-extrabold text-display-md leading-none';

/** Kiosk minimum tap target (architecture §9). Applied to every timer control. */
export const TIMER_TAP_TARGET_CLASS = 'min-h-12 min-w-12';

/** Inline style for the expired-timer breath — one slow cycle, never a flash. */
export const OVERRUN_PULSE_STYLE = {
  animationName: 'timer-breath',
  animationDuration: `${OVERRUN_PULSE_MS}ms`,
  animationIterationCount: 'infinite',
  animationTimingFunction: 'ease-in-out',
} as const;
