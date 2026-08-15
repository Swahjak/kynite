/**
 * The `reminders:scan` look-ahead (docs/architecture.md §8: "runs every minute
 * with a 90s look-ahead and an idempotency key of `(routineId,
 * occurrenceDate, memberId)`").
 *
 * Pure: given routines and an instant, which reminders are due to be sent.
 * The database work (which routines exist, which ones were already sent) is
 * `../reminders.ts`'s; deciding *what is due* is a function of a clock and an
 * RRULE and belongs here, where it can be tested at a frozen instant without
 * a Postgres.
 *
 * The one cross-slice import is `routines/domain/occurrence`, the sanctioned
 * `domain`-to-`domain` exception in `eslint.config.mjs`: expanding a routine's
 * rule in the family's zone is exactly what that module is, and reimplementing
 * it here would be two answers to one question.
 */

import {
  dateKeyOf,
  occurrenceStartsBetween,
  type OccurrenceInput,
} from '@/modules/routines/domain/occurrence';
import type { Schedule } from '@/modules/routines/domain/schedule';

/**
 * §8's 90 seconds. Wider than the 60s cadence on purpose: a scan that runs a
 * few seconds late must still see the occurrence the previous scan was too
 * early for. The overlap is what the idempotency key exists to absorb.
 *
 * **What this makes the reminder's lead time.** The first scan that sees an
 * occurrence claims it, and scans run every minute, so the notification lands
 * between roughly 30 and 90 seconds before the routine starts — call it *about
 * a minute*. It is not a five-minute warning and nothing here configures one:
 * a per-routine lead is a product decision (and a schema column) that M11 does
 * not make. The body says the number it actually computes (`minutesUntil`), so
 * a one-minute lead reads "over 1 minuut" rather than claiming five.
 */
export const LOOK_AHEAD_MS = 90_000;

export type ScannableRoutine = {
  id: string;
  familyId: string;
  /** Where the reminder goes. The routine's owner, never its creator (FR10). */
  ownerMemberId: string;
  schedule: Schedule;
  /** `routine.createdAt` — the series' DTSTART (see `OccurrenceInput`). */
  anchor: Date;
};

export type DueReminder = {
  familyId: string;
  routineId: string;
  memberId: string;
  /** `YYYY-MM-DD` in the family's zone — one third of the idempotency key. */
  occurrenceDate: string;
  dueAt: Date;
};

/**
 * Reminders whose occurrence starts inside `[now, now + lookAheadMs)`.
 *
 * Half-open at both ends of the *scan*, not of the day: an occurrence exactly
 * at `now` is due (the minute it belongs to has arrived), one exactly at the
 * far edge is left for the next pass, so no instant is claimed by two windows
 * for a reason other than the deliberate 30s overlap.
 */
export function dueReminders(
  routines: readonly ScannableRoutine[],
  now: Date,
  timeZone: string,
  lookAheadMs: number = LOOK_AHEAD_MS
): DueReminder[] {
  const to = new Date(now.getTime() + lookAheadMs);

  return routines.flatMap((routine): DueReminder[] => {
    const input: OccurrenceInput = {
      schedule: routine.schedule,
      anchor: routine.anchor,
      timeZone,
    };

    return occurrenceStartsBetween(input, now, to).map((dueAt) => ({
      familyId: routine.familyId,
      routineId: routine.id,
      memberId: routine.ownerMemberId,
      occurrenceDate: dateKeyOf(dueAt, timeZone),
      dueAt,
    }));
  });
}

/**
 * Whole minutes from `now` until `dueAt`, rounded to the nearest minute and
 * floored at zero.
 *
 * This is the number the notification says out loud ("over 1 minuut" for the
 * lead `LOOK_AHEAD_MS` actually produces), so it rounds the way a person would
 * rather than truncating: 40s is "1 minute", not "0".
 */
export function minutesUntil(dueAt: Date, now: Date): number {
  return Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 60_000));
}
