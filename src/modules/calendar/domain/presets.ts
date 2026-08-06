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

/** The preset a stored RRULE corresponds to — `custom` when none of them do. */
export function presetFor(rrule: string | null): RecurrencePreset {
  if (!rrule) return 'none';

  const normalized = rrule.trim().toUpperCase();
  for (const preset of RECURRENCE_PRESETS) {
    if (RULES[preset] && RULES[preset] === normalized) return preset;
  }
  return 'custom';
}

/** True when the selection must leave the stored rule exactly as it is. */
export function preservesExistingRule(preset: RecurrencePreset): boolean {
  return preset === 'custom';
}
