import { describe, expect, it } from 'vitest';
import {
  LOOK_AHEAD_MS,
  dueReminders,
  minutesUntil,
  type ScannableRoutine,
} from '@/modules/notifications/domain/reminder-window';
import { QUEUE, QUEUE_DEFINITIONS, queueName, reminderKey } from '@/modules/notifications/queues';

/**
 * The `reminders:scan` look-ahead (docs/architecture.md §8: "runs every minute
 * with a 90s look-ahead and an idempotency key of `(routineId,
 * occurrenceDate, memberId)`").
 *
 * The 30-second overlap between cadence and window is deliberate and is the
 * whole reason the idempotency key exists: without the overlap a scan that
 * runs a second late drops an occurrence silently, and with it every
 * occurrence is seen twice. This file pins both halves.
 */

const ZONE = 'Europe/Amsterdam';

const routine = (overrides: Partial<ScannableRoutine> = {}): ScannableRoutine => ({
  id: 'routine-1',
  familyId: 'family-1',
  ownerMemberId: 'child-1',
  schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
  // Well before any instant these tests use, so the series is live.
  anchor: new Date('2026-01-01T06:00:00Z'),
  ...overrides,
});

/** `07:30` Amsterdam on 10 March 2026 is `06:30Z` (CET, UTC+1). */
const DUE_AT = new Date('2026-03-10T06:30:00Z');

describe('reminder look-ahead', () => {
  it('is 90 seconds — wider than the 60s cadence', () => {
    expect(LOOK_AHEAD_MS).toBe(90_000);

    const scan = QUEUE_DEFINITIONS.find((definition) => definition.name === QUEUE.remindersScan);
    expect(scan?.cron).toBe('* * * * *');
  });

  it('finds an occurrence that falls inside the window', () => {
    // 60 seconds before the routine is due: inside 90s, so it is due to send.
    const now = new Date(DUE_AT.getTime() - 60_000);

    expect(dueReminders([routine()], now, ZONE)).toEqual([
      {
        familyId: 'family-1',
        routineId: 'routine-1',
        memberId: 'child-1',
        occurrenceDate: '2026-03-10',
        dueAt: DUE_AT,
      },
    ]);
  });

  it('does not find one that is still beyond the window', () => {
    const now = new Date(DUE_AT.getTime() - LOOK_AHEAD_MS - 1000);
    expect(dueReminders([routine()], now, ZONE)).toEqual([]);
  });

  it('does not find one that has already passed', () => {
    const now = new Date(DUE_AT.getTime() + 1000);
    expect(dueReminders([routine()], now, ZONE)).toEqual([]);
  });

  it('sees the same occurrence from two consecutive scans — which the key absorbs', () => {
    // The overlap in the flesh: a scan at T-89s and the next at T-29s both see
    // it. Two dispatch jobs, one idempotency key, one notification.
    const early = dueReminders([routine()], new Date(DUE_AT.getTime() - 89_000), ZONE);
    const late = dueReminders([routine()], new Date(DUE_AT.getTime() - 29_000), ZONE);

    expect(early).toHaveLength(1);
    expect(late).toHaveLength(1);
    expect(reminderKey(early[0])).toBe(reminderKey(late[0]));
  });

  it('routes to the routine owner, not to anyone else', () => {
    const [due] = dueReminders(
      [routine({ ownerMemberId: 'the-owner' })],
      new Date(DUE_AT.getTime() - 30_000),
      ZONE
    );

    expect(due.memberId).toBe('the-owner');
  });

  it('dates the occurrence in the family zone, not in UTC', () => {
    // 00:30 Amsterdam on 11 March is 23:30Z on the *10th*. The occurrence
    // belongs to the 11th — the day the household is living in.
    const midnightRoutine = routine({
      schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:30' },
    });
    const now = new Date('2026-03-10T23:29:00Z');

    const [due] = dueReminders([midnightRoutine], now, ZONE);
    expect(due.occurrenceDate).toBe('2026-03-11');
  });

  it('returns nothing for a rule it cannot parse, rather than throwing', () => {
    const broken = routine({ schedule: { rrule: 'NOT AN RRULE', timeOfDay: '07:30' } });
    expect(dueReminders([broken], new Date(DUE_AT.getTime() - 30_000), ZONE)).toEqual([]);
  });

  it('skips a day the rule does not cover', () => {
    // Weekdays only; 2026-03-14 is a Saturday.
    const weekdays = routine({
      schedule: { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', timeOfDay: '07:30' },
    });
    const saturday = new Date('2026-03-14T06:29:30Z');

    expect(dueReminders([weekdays], saturday, ZONE)).toEqual([]);
  });
});

describe('minutes until', () => {
  it('rounds the way a person would', () => {
    const now = new Date('2026-03-10T06:00:00Z');

    expect(minutesUntil(new Date('2026-03-10T06:05:00Z'), now)).toBe(5);
    // 4m40s is "5 minutes", not "4": the notification says it out loud.
    expect(minutesUntil(new Date('2026-03-10T06:04:40Z'), now)).toBe(5);
    expect(minutesUntil(new Date('2026-03-10T06:04:00Z'), now)).toBe(4);
  });

  it('floors at zero for an occurrence that is already due', () => {
    const now = new Date('2026-03-10T06:00:00Z');
    expect(minutesUntil(new Date('2026-03-10T05:58:00Z'), now)).toBe(0);
  });
});

describe('queue naming', () => {
  it('adapts the documented colon form to what pg-boss 12 accepts', () => {
    // §8's vocabulary is `reminders:scan`; pg-boss forbids `:` in a queue name.
    expect(queueName(QUEUE.remindersScan)).toBe('reminders.scan');
    expect(queueName(QUEUE.remindersDispatch)).toBe('reminders.dispatch');
    expect(queueName(QUEUE.pushSend)).toBe('push.send');

    for (const definition of QUEUE_DEFINITIONS) {
      expect(queueName(definition.name)).toMatch(/^[A-Za-z0-9_\-./]+$/);
    }
  });

  it('keys a reminder by (routine, occurrence date, member) — §8 verbatim', () => {
    expect(reminderKey({ routineId: 'r', occurrenceDate: '2026-03-10', memberId: 'm' })).toBe(
      'r:2026-03-10:m'
    );
  });
});
