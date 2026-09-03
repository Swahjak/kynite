/**
 * The recurrence patterns a parent can pick in the event dialog.
 *
 * A preset list rather than a free-text RRULE field, for two reasons. RFC-5545
 * is not a thing to hand a parent at 07:40 on a school morning; and every
 * preset here is a rule `domain/rrule.ts` fully models, so what the dialog can
 * author and what the expander can render are the same set by construction.
 *
 * The custody entries are the patterns docs/architecture.md §3 requires (FR5).
 * An imported Google series can of course carry any rule at all — reading stays
 * liberal — so `presetFor()` reports "custom" rather than pretending a rule it
 * did not author is one of these.
 */

import { WEEKDAYS, type Weekday } from './rrule';
import { isoWeekday, toWall } from './zone';

export const RECURRENCE_PRESETS = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
  /** Custody: alternating weeks (§3). */
  'custody-alternating-weeks',
  /** Custody: every 1st and 3rd weekend (§3). */
  'custody-first-third-weekend',
  /** Anything imported that is none of the above. Never authored by the UI. */
  'custom',
] as const;

export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

const RULES: Record<RecurrencePreset, string | null> = {
  none: null,
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
  'custody-alternating-weeks': 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
  'custody-first-third-weekend': 'FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3',
  // `custom` is a *reading* of an existing rule, never a rule to write. The
  // dialog keeps the stored RRULE untouched when this is the selection.
  custom: null,
};

/** The RRULE a preset writes, or null for a one-off. */
export function ruleForPreset(preset: RecurrencePreset): string | null {
  return RULES[preset];
}

/**
 * A weekly rule on specific weekdays — Google-Calendar-style chips (e.g. a
 * school run on ma/di/do/vr). Days are written in `WEEKDAYS` order regardless
 * of the order they were selected in, so the stored rule is stable and so
 * `weeklyDaysOf` round-trips it.
 */
export function ruleForWeeklyDays(days: readonly Weekday[]): string {
  const ordered = WEEKDAYS.filter((day) => days.includes(day));
  return `FREQ=WEEKLY;BYDAY=${ordered.join(',')}`;
}

/**
 * The weekdays of a rule shaped exactly like `ruleForWeeklyDays` writes —
 * `FREQ=WEEKLY;BYDAY=<plain weekday codes>` and nothing else — or `null` when
 * the rule isn't that shape (a different `FREQ`, an `INTERVAL`, an ordinal
 * like `1MO`, or any other RFC-5545 part).
 *
 * This is what lets the dialog keep a school schedule (`FREQ=WEEKLY;BYDAY=MO,
 * TU,TH,FR`) editable as `weekly` + chips on open, rather than degrading it to
 * the read-only `custom` bucket the way a genuinely foreign import would be.
 */
export function weeklyDaysOf(rrule: string | null): Weekday[] | null {
  if (!rrule) return null;

  const parts = rrule.trim().toUpperCase().split(';').filter(Boolean);
  if (parts.length !== 2) return null;

  const fields = new Map<string, string>();
  for (const part of parts) {
    const separator = part.indexOf('=');
    if (separator === -1) return null;
    fields.set(part.slice(0, separator), part.slice(separator + 1));
  }

  if (fields.get('FREQ') !== 'WEEKLY') return null;

  const byDay = fields.get('BYDAY');
  if (!byDay) return null;

  const days = byDay.split(',');
  if (days.length === 0) return null;
  if (new Set(days).size !== days.length) return null;
  if (!days.every((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day))) {
    return null;
  }

  return WEEKDAYS.filter((day) => days.includes(day));
}

/**
 * `input.byweekday` (the event dialog's weekly chips) reduced to a rule, but
 * only when it says something the bare `weekly` preset doesn't already: a
 * single day that matches DTSTART's own weekday is the default the dialog
 * prefilled, unedited, so writing it out as an explicit `BYDAY` would only
 * add RRULE surface for no behavioural difference (`domain/rrule.ts` reads a
 * `BYDAY`-less weekly rule as "keep DTSTART's weekday" already).
 *
 * Lives in the domain layer rather than `actions.ts` (where it originated) so
 * the timezone-crossing edge — DTSTART's *wall* weekday can differ from its
 * UTC-instant calendar day near midnight — is unit-testable without a
 * database: `isoWeekday(toWall(...))` is exactly the pair `expand.test.ts`
 * and `zone.test.ts` already exercise this way.
 */
export function ruleForWeeklySelection(
  byweekday: readonly Weekday[] | undefined,
  startsAt: Date,
  timeZone: string
): string {
  if (!byweekday || byweekday.length === 0) return ruleForPreset('weekly')!;

  if (byweekday.length === 1) {
    const startWeekday = WEEKDAYS[isoWeekday(toWall(startsAt, timeZone)) - 1];
    if (byweekday[0] === startWeekday) return ruleForPreset('weekly')!;
  }

  return ruleForWeeklyDays(byweekday);
}

/** The preset a stored RRULE corresponds to — `custom` when none of them do. */
export function presetFor(rrule: string | null): RecurrencePreset {
  if (!rrule) return 'none';

  const normalized = rrule.trim().toUpperCase();
  for (const preset of RECURRENCE_PRESETS) {
    if (RULES[preset] && RULES[preset] === normalized) return preset;
  }
  // A weekly rule on a subset of weekdays that isn't one of the fixed presets
  // above (`weekdays` is checked first and wins the exact match when it
  // applies) still maps to `weekly` — the dialog can author and re-author it
  // via the weekday chips, so it is not `custom`.
  if (weeklyDaysOf(normalized) !== null) return 'weekly';
  return 'custom';
}

/** True when the selection must leave the stored rule exactly as it is. */
export function preservesExistingRule(preset: RecurrencePreset): boolean {
  return preset === 'custom';
}
