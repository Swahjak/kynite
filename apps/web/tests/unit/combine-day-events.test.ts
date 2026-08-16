import { describe, expect, it } from 'vitest';
import { combineDayEvents, type CombinableEvent } from '@/modules/calendar/domain/day-board';

/**
 * M23: `/today`'s day board gained a second mode — one merged, chronological
 * list of everybody's day instead of one column per person.
 *
 * The per-person board deliberately *duplicates* an event into every column it
 * belongs to. A merged list must do the opposite, and these tests pin that
 * inversion: one row per event, in time order, carrying every member it is for
 * in the family's own order.
 *
 * Amsterdam throughout, because the interesting boundary cases (an event that
 * starts before local midnight, an all-day row stored in UTC) only exist for a
 * zone that is not UTC.
 */

const TZ = 'Europe/Amsterdam';
const DAY = '2026-03-10';

function event(over: Partial<CombinableEvent> & { key: string }): CombinableEvent {
  return {
    startsAt: new Date('2026-03-10T09:00:00Z'),
    endsAt: new Date('2026-03-10T10:00:00Z'),
    allDay: false,
    ownerMemberId: null,
    attendeeMemberIds: [],
    ...over,
  };
}

describe('combineDayEvents', () => {
  it('renders a shared event once, with every member on it', () => {
    // The same dinner reached the list from two columns' worth of members. In
    // a merged list that is one commitment, not two.
    const dinner = event({
      key: 'dinner',
      ownerMemberId: 'mila',
      attendeeMemberIds: ['daan', 'sanne'],
    });

    const rows = combineDayEvents([dinner, dinner], ['sanne', 'mila', 'daan'], {
      timeZone: TZ,
      dayKey: DAY,
    });

    expect(rows).toHaveLength(1);
    // Family order (`sortOrder`), not the order they hung off the event.
    expect(rows[0].memberIds).toEqual(['sanne', 'mila', 'daan']);
  });

  it('drops members who are not in the family and events with nobody on them', () => {
    const rows = combineDayEvents(
      [
        event({ key: 'ghost', ownerMemberId: 'left-the-family', attendeeMemberIds: ['also-gone'] }),
        event({ key: 'nobody' }),
      ],
      ['sanne'],
      { timeZone: TZ, dayKey: DAY }
    );

    // Both rows survive — a family event belongs to the day even when it
    // belongs to no one — but neither claims a face it cannot draw.
    expect(rows.map((row) => row.event.key)).toEqual(['ghost', 'nobody']);
    // `[]`, not `null`: neither row is redacted, they simply name nobody this
    // family can resolve. `null` is the separate "withheld" state a busy-only
    // row gets, and the difference is what stops a redacted hour reading as
    // "Iedereen" — see the case below.
    expect(rows.every((row) => row.memberIds?.length === 0)).toBe(true);
  });

  /**
   * §7 `calendar:view_private` → `busy-only`. `queries.ts` keeps
   * `ownerMemberId` on a redacted row because it is the only routing signal
   * left — so this is where the *name* derived from it has to stop, once,
   * rather than at each of the three surfaces that draw a row.
   *
   * `null`, never `[]`: every consumer renders an empty list as "Iedereen" plus
   * the whole household's faces, and "this hidden hour is the household's" is
   * itself a disclosure — it narrows the alternative to "and that one is one
   * person's". The nullable type is also what makes a *fourth* consumer say
   * what it draws instead of falling through to the everyone branch.
   */
  it('withholds the audience of a busy-only row while keeping its placement', () => {
    const rows = combineDayEvents(
      [
        event({ key: 'private', ownerMemberId: 'mila', busyOnly: true }),
        event({ key: 'private-household', householdWide: true, busyOnly: true }),
      ],
      ['sanne', 'mila', 'daan'],
      { timeZone: TZ, dayKey: DAY }
    );

    expect(rows.map((row) => row.memberIds)).toEqual([null, null]);
    // Placement is untouched: the block still belongs on Mila's day, which is
    // what `ownerMemberId` survives redaction for. Ids, never names.
    expect(rows[0].placementMemberIds).toEqual(['mila']);
    expect(rows[1].placementMemberIds).toEqual(['sanne', 'mila', 'daan']);
  });

  it('puts all-day events first and the rest in time order', () => {
    const rows = combineDayEvents(
      [
        event({ key: 'evening', startsAt: new Date('2026-03-10T18:00:00Z') }),
        event({
          key: 'holiday',
          allDay: true,
          startsAt: new Date('2026-03-10T00:00:00Z'),
          endsAt: new Date('2026-03-11T00:00:00Z'),
        }),
        event({ key: 'morning', startsAt: new Date('2026-03-10T07:00:00Z') }),
      ],
      [],
      { timeZone: TZ, dayKey: DAY }
    );

    expect(rows.map((row) => row.event.key)).toEqual(['holiday', 'morning', 'evening']);
  });

  it('breaks a tie on end time, then on key, so the order is total', () => {
    const rows = combineDayEvents(
      [
        event({ key: 'b-short', endsAt: new Date('2026-03-10T09:30:00Z') }),
        event({ key: 'a-long', endsAt: new Date('2026-03-10T11:00:00Z') }),
        event({ key: 'a-short', endsAt: new Date('2026-03-10T09:30:00Z') }),
      ],
      [],
      { timeZone: TZ, dayKey: DAY }
    );

    expect(rows.map((row) => row.event.key)).toEqual(['a-short', 'b-short', 'a-long']);
  });

  it('keeps only what touches the day, in the household zone', () => {
    const rows = combineDayEvents(
      [
        // 23:30 UTC on the 9th is 00:30 Amsterdam on the 10th — this one is
        // today's, and a UTC-shaped filter would have missed it.
        event({
          key: 'late-night',
          startsAt: new Date('2026-03-09T23:30:00Z'),
          endsAt: new Date('2026-03-10T00:30:00Z'),
        }),
        // 23:30 UTC on the 10th is already the 11th locally.
        event({
          key: 'tomorrow',
          startsAt: new Date('2026-03-10T23:30:00Z'),
          endsAt: new Date('2026-03-11T00:30:00Z'),
        }),
        event({ key: 'today' }),
      ],
      [],
      { timeZone: TZ, dayKey: DAY }
    );

    expect(rows.map((row) => row.event.key)).toEqual(['late-night', 'today']);
  });

  it('spans a multi-day event onto every day it covers', () => {
    const trip = event({
      key: 'trip',
      startsAt: new Date('2026-03-09T08:00:00Z'),
      endsAt: new Date('2026-03-11T17:00:00Z'),
    });

    expect(combineDayEvents([trip], [], { timeZone: TZ, dayKey: DAY })).toHaveLength(1);
    expect(combineDayEvents([trip], [], { timeZone: TZ, dayKey: '2026-03-09' })).toHaveLength(1);
    expect(combineDayEvents([trip], [], { timeZone: TZ, dayKey: '2026-03-12' })).toHaveLength(0);
  });
});
