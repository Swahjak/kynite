/**
 * RFC-5545 recurrence, stored verbatim (docs/architecture.md §3 "Recurrence
 * decision").
 *
 * Google hands us `recurrence: ["RRULE:…", "EXDATE;TZID=…:…", "RDATE:…"]` and
 * takes the same array back. We keep every line byte-identical apart from the
 * `RRULE:` property name, which the `event.rrule` column implies. That is the
 * whole reason `singleEvents=false`: expanding server-side would destroy the
 * custody-week model, and re-serialising a *parsed* rule would silently drop
 * anything we did not model (`WKST`, `BYSETPOS`, `UNTIL` precision).
 *
 * The one normalisation we do apply is *line order*: output is always RRULE →
 * RDATE → EXDATE. RFC-5545 gives property order no meaning inside a component,
 * and the three columns cannot encode an interleaving anyway. Every line's
 * value, including its parameters, is byte-identical to what Google sent.
 *
 * Multiple `RRULE` lines on one series — §3's "two RRULEs on one custody event
 * series" for a 2-2-3 rotation — are joined with `\n` in the single `rrule`
 * text column, the same separator RFC-5545 uses between content lines. Round
 * trip is exact.
 */

export type Recurrence = {
  rrule: string | null;
  rdates: string[];
  exdates: string[];
};

const RRULE_PREFIX = 'RRULE:';

function propertyName(line: string): string {
  // `EXDATE;TZID=Europe/Amsterdam:2026…` → `EXDATE`
  const separator = line.search(/[;:]/);
  return (separator === -1 ? line : line.slice(0, separator)).toUpperCase();
}

/** Google `recurrence[]` → the three `event` columns. */
export function parseRecurrence(lines: readonly string[] | undefined | null): Recurrence {
  const rrules: string[] = [];
  const rdates: string[] = [];
  const exdates: string[] = [];

  for (const raw of lines ?? []) {
    const line = raw.trim();
    if (line === '') continue;

    switch (propertyName(line)) {
      case 'RRULE':
        // Only the property name is dropped; parameters and value survive.
        rrules.push(line.slice(RRULE_PREFIX.length));
        break;
      case 'EXDATE':
        exdates.push(line);
        break;
      case 'RDATE':
        rdates.push(line);
        break;
      default:
        // EXRULE is deprecated and Google never sends it; anything else is not
        // ours to invent. Dropping is safer than guessing a column for it.
        break;
    }
  }

  return {
    rrule: rrules.length > 0 ? rrules.join('\n') : null,
    rdates,
    exdates,
  };
}

/** The three `event` columns → Google `recurrence[]`. Inverse of `parseRecurrence`. */
export function serializeRecurrence(recurrence: Recurrence): string[] {
  const lines: string[] = [];

  if (recurrence.rrule) {
    for (const rule of recurrence.rrule.split('\n')) {
      if (rule.trim() !== '') lines.push(`${RRULE_PREFIX}${rule}`);
    }
  }
  lines.push(...recurrence.rdates);
  lines.push(...recurrence.exdates);

  return lines;
}

/** True when the row carries any recurrence at all. */
export function isRecurring(recurrence: Recurrence): boolean {
  return !!recurrence.rrule || recurrence.rdates.length > 0;
}
