import type { IconName } from '@kynite/ui';
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
 * `font-variant-numeric: tabular-nums` on Baloo 2 (globals.css) — without it
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

/**
 * The icons a timer may wear (M-T1), mirroring `modules/routines/ui/tokens.ts`'s
 * `ROUTINE_ICONS` pattern: a closed set, validated against in `startTimerAction`
 * so a form value that reaches the server is a name this font actually ships,
 * never an arbitrary string.
 *
 * `timer` is the default — a plain hourglass reads as "this is a countdown"
 * before it reads as anything else. The rest are purposeful rather than
 * exhaustive: one per thing a family actually times (screen time, a game, a
 * chapter, bedtime, a meal, the bath) plus a second, more literal hourglass
 * for "just a countdown, no theme".
 *
 * **Font subset note (M-T2 carry-forward):** every name below already has a
 * glyph in `scripts/material-symbols.codepoints` (the full font's manifest),
 * and `tv`, `smart_display` and `shower` were added to `EXTRA_ICONS` in
 * `scripts/subset-icons.mjs` and to the shipped subset by this milestone
 * ahead of the picker that renders them — `pnpm icons:check`'s static scan
 * cannot see `TIMER_ICONS` itself (it walks `<Icon name="…">` JSX, not
 * `as const` arrays; see that file's own `EXTRA_ICONS` comment), so **M-T2
 * must still render every one of these through `<Icon name={option}>` in the
 * icon picker it builds**, the same way `routine-dialog.tsx` renders
 * `ROUTINE_ICONS` — the `EXTRA_ICONS` entry is the promise, the picker is
 * what keeps it true once these entries are ever pruned back out again.
 */
export const TIMER_ICONS = [
  'timer',
  'tv',
  'smart_display',
  'sports_esports',
  'menu_book',
  'bedtime',
  'restaurant',
  'shower',
  'hourglass_top',
] as const satisfies readonly IconName[];

export type TimerIcon = (typeof TIMER_ICONS)[number];

export const DEFAULT_TIMER_ICON: TimerIcon = 'timer';

export function isTimerIcon(value: string): value is TimerIcon {
  return (TIMER_ICONS as readonly string[]).includes(value);
}

/**
 * What a tile actually renders: the timer's own icon first, then the parent
 * routine's (surfaced on `TimerView` as `routineIcon` — see `page-data.ts`),
 * then the default.
 *
 * The routine fallback is deliberately *not* narrowed through `isTimerIcon`:
 * a routine's icon comes from `ROUTINE_ICONS`, a different closed set that
 * already shares most of its glyphs with this one but is not required to
 * (`event_available`, `checklist`, … are routine-only). It was validated
 * once, at the routine's own write time
 * (`modules/routines/actions.ts`) — this just trusts the column, the same way
 * `phaseOf` trusts `stoppedAt`.
 */
export function timerIconOf(view: { icon: string | null; routineIcon?: string | null }): IconName {
  if (view.icon && isTimerIcon(view.icon)) return view.icon;
  if (view.routineIcon) return view.routineIcon as IconName;
  return DEFAULT_TIMER_ICON;
}
