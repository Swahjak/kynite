import { describe, expect, it } from 'vitest';
import {
  bucketByDay,
  splitByMember,
  type CombinableEvent,
} from '@/modules/calendar/domain/day-board';

/**
 * The two per-day groupings every calendar surface was writing out by hand.
 *
 * Nine components between `modules/calendar/ui` and `modules/today/ui` had
 * their own copy of one of these loops. Five bucketed events into days; four
 * split a day's events between the people it belongs to. The copies had drifted
 * — not in ways a reader would spot side by side, but in ways that changed what
 * a family sees on the wall — so these tests pin the merged behaviour, and in
 * particular the two places where the copies genuinely disagreed:
 *
 * 1. **All-day ordering.** Two copies sorted a bucket by `startsAt` alone. An
 *    all-day row is stored as a UTC midnight, so in Amsterdam it sorts as
 *    01:00 — after a 00:30 event and before everything else, which is an
 *    arbitrary position nobody chose. Every other surface (`combineDayEvents`,
 *    `/today`'s person tab) puts all-day rows first, because they frame the day
 *    rather than sit in it. That is now the one order.
 *
 * 2. **Attributed to nobody on screen.** Three copies promoted such an event
 *    into the shared "Iedereen" lane; one dropped it. The drop is correct and
 *    it is a privacy rule, not a display preference — see the block on
 *    `splitByMember` below.
 *
 * Amsterdam throughout, matching `combine-day-events.test.ts`: the interesting
 * boundaries (an all-day row stored in UTC, an event running through local
 * midnight) do not exist in a zone that is UTC.
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

/** An all-day row as M05 stores one: UTC midnights, exclusive end. */
function allDayEvent(key: string, from: string, toExclusive: string): CombinableEvent {
  return event({
    key,
    allDay: true,
    startsAt: new Date(`${from}T00:00:00Z`),
    endsAt: new Date(`${toExclusive}T00:00:00Z`),
  });
}

describe('bucketByDay', () => {
  it('keys a timed event by the viewer zone, not by UTC', () => {
    // 23:30 Amsterdam on the 10th is 22:30Z — still the 10th to the family.
    const late = event({
      key: 'late',
      startsAt: new Date('2026-03-10T22:30:00Z'),
      endsAt: new Date('2026-03-10T23:00:00Z'),
    });

    const buckets = bucketByDay([late], { timeZone: TZ });
    expect([...buckets.keys()]).toEqual([DAY]);
  });

  it('puts a multi-day event in every day it touches', () => {
    // 23:00 on the 10th until 10:00 on the 11th, local.
    const overnight = event({
      key: 'overnight',
      startsAt: new Date('2026-03-10T22:00:00Z'),
      endsAt: new Date('2026-03-11T09:00:00Z'),
    });

    const buckets = bucketByDay([overnight], { timeZone: TZ });
    expect([...buckets.keys()].sort()).toEqual(['2026-03-10', '2026-03-11']);
    // The same object, not a slice of it: a month grid draws the whole chip in
    // each cell it spans.
    expect(buckets.get('2026-03-10')).toEqual([overnight]);
    expect(buckets.get('2026-03-11')).toEqual([overnight]);
  });

  it('does not spill an event that ends exactly at local midnight into the next day', () => {
    const untilMidnight = event({
      key: 'until-midnight',
      startsAt: new Date('2026-03-10T20:00:00Z'),
      endsAt: new Date('2026-03-10T23:00:00Z'), // 00:00 local on the 11th
    });

    expect([...bucketByDay([untilMidnight], { timeZone: TZ }).keys()]).toEqual([DAY]);
  });

  it('buckets an all-day row in UTC, so a one-day event stays one day', () => {
    // Read in Amsterdam these midnights would smear across two days — the
    // reason `dayKeysOf` pins all-day bucketing to UTC.
    const buckets = bucketByDay([allDayEvent('vrij', '2026-03-10', '2026-03-11')], {
      timeZone: TZ,
    });
    expect([...buckets.keys()]).toEqual([DAY]);
  });

  it('spans an all-day range across its whole exclusive end', () => {
    const buckets = bucketByDay([allDayEvent('kamp', '2026-03-10', '2026-03-13')], {
      timeZone: TZ,
    });
    expect([...buckets.keys()].sort()).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);
  });

  it('orders each bucket all-day first, then by start', () => {
    const morning = event({
      key: 'morning',
      startsAt: new Date('2026-03-10T07:00:00Z'),
      endsAt: new Date('2026-03-10T08:00:00Z'),
    });
    const afternoon = event({ key: 'afternoon' });
    const whole = allDayEvent('whole', '2026-03-10', '2026-03-11');

    const buckets = bucketByDay([afternoon, whole, morning], { timeZone: TZ });
    expect(buckets.get(DAY)?.map((entry) => entry.key)).toEqual(['whole', 'morning', 'afternoon']);
  });

  it('breaks a start tie by end and then by key, so a re-render never reshuffles', () => {
    const short = event({ key: 'b-short', endsAt: new Date('2026-03-10T09:30:00Z') });
    const long = event({ key: 'a-long', endsAt: new Date('2026-03-10T11:00:00Z') });
    const twin = event({ key: 'a-twin', endsAt: new Date('2026-03-10T09:30:00Z') });

    const buckets = bucketByDay([long, twin, short], { timeZone: TZ });
    expect(buckets.get(DAY)?.map((entry) => entry.key)).toEqual(['a-twin', 'b-short', 'a-long']);
  });

  it('de-duplicates an event handed in twice', () => {
    const dinner = event({ key: 'dinner' });
    const buckets = bucketByDay([dinner, dinner], { timeZone: TZ });
    expect(buckets.get(DAY)).toHaveLength(1);
  });

  describe('dayKeys', () => {
    it('restricts bucketing to the window it names', () => {
      const inside = event({ key: 'inside' });
      const outside = event({
        key: 'outside',
        startsAt: new Date('2026-04-01T09:00:00Z'),
        endsAt: new Date('2026-04-01T10:00:00Z'),
      });

      const buckets = bucketByDay([inside, outside], { timeZone: TZ, dayKeys: [DAY] });
      expect([...buckets.keys()]).toEqual([DAY]);
      expect(buckets.get(DAY)?.map((entry) => entry.key)).toEqual(['inside']);
    });

    it('clips a multi-day event to the days inside the window', () => {
      const overnight = event({
        key: 'overnight',
        startsAt: new Date('2026-03-10T22:00:00Z'),
        endsAt: new Date('2026-03-11T09:00:00Z'),
      });

      const buckets = bucketByDay([overnight], { timeZone: TZ, dayKeys: [DAY] });
      expect([...buckets.keys()]).toEqual([DAY]);
    });

    it('creates no bucket for a day nothing happens on, by default', () => {
      // The agenda view lists only days that have something on them, so an
      // empty bucket there would render a heading over nothing.
      const buckets = bucketByDay([event({ key: 'only' })], {
        timeZone: TZ,
        dayKeys: [DAY, '2026-03-11'],
      });
      expect([...buckets.keys()]).toEqual([DAY]);
    });

    it('seeds an empty bucket for every named day when asked', () => {
      // A time grid draws a column per day whether or not it has events, and
      // wants `get(key)` to be an array rather than undefined.
      const buckets = bucketByDay([event({ key: 'only' })], {
        timeZone: TZ,
        dayKeys: [DAY, '2026-03-11'],
        seedEmpty: true,
      });
      expect([...buckets.keys()]).toEqual([DAY, '2026-03-11']);
      expect(buckets.get('2026-03-11')).toEqual([]);
    });

    it('keeps the seeded keys in the order they were given', () => {
      const buckets = bucketByDay([], {
        timeZone: TZ,
        dayKeys: ['2026-03-12', '2026-03-10', '2026-03-11'],
        seedEmpty: true,
      });
      expect([...buckets.keys()]).toEqual(['2026-03-12', '2026-03-10', '2026-03-11']);
    });
  });
});

describe('splitByMember', () => {
  const FAMILY = ['sanne', 'mila', 'daan'];

  it('puts an event in the column of everyone it names', () => {
    const swimming = event({
      key: 'swimming',
      ownerMemberId: 'mila',
      attendeeMemberIds: ['daan'],
    });

    const { byMember, shared } = splitByMember([swimming], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(byMember.get('mila')?.map((entry) => entry.key)).toEqual(['swimming']);
    expect(byMember.get('daan')?.map((entry) => entry.key)).toEqual(['swimming']);
    expect(byMember.get('sanne')).toEqual([]);
    expect(shared).toEqual([]);
  });

  it('has a bucket for every member, even an empty one', () => {
    const { byMember } = splitByMember([], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect([...byMember.keys()]).toEqual(FAMILY);
  });

  it('shares an event nobody is attached to', () => {
    // Nothing claimed it, so it is the household's — a school-holiday row, a
    // manually created "opa & oma komen".
    const { byMember, shared } = splitByMember([event({ key: 'unclaimed' })], FAMILY, {
      timeZone: TZ,
      dayKey: DAY,
    });
    expect(shared.map((entry) => entry.key)).toEqual(['unclaimed']);
    for (const list of byMember.values()) expect(list).toEqual([]);
  });

  it('shares a household event even when attribution names one person', () => {
    /**
     * The disagreement that mattered most between the four copies: the day
     * grid never consulted `householdWide` at all. An event on the Google
     * calendar bound to "Gezin" carries that calendar owner's member id, so
     * the grid drew family dinner as one parent's appointment and left the
     * children's columns empty. `householdWide` outranks attribution (M23).
     */
    const dinner = event({
      key: 'dinner',
      householdWide: true,
      ownerMemberId: 'sanne',
      attendeeMemberIds: ['mila'],
    });

    const { byMember, shared } = splitByMember([dinner], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(shared.map((entry) => entry.key)).toEqual(['dinner']);
    for (const list of byMember.values()) expect(list).toEqual([]);
  });

  it('drops an event attributed only to people this board does not render', () => {
    /**
     * The privacy rule, and the reason this function exists in `domain/` with
     * a test rather than in four components without one.
     *
     * An event whose only participants are members the caller did not pass —
     * a soft-deleted member, or one the parent unticked from the face row —
     * is *dropped*. It must never fall through into the shared lane: that
     * lane is captioned "Iedereen" and spans the whole family, so promoting a
     * hidden person's appointment into it shows their private schedule to
     * everyone standing in front of the wall display. A missing block is a
     * display gap; a leaked one is a privacy failure.
     *
     * Three of the four copies got this wrong and promoted. Only the day grid
     * dropped, with the argument written out beside it. That argument wins.
     */
    const hidden = event({
      key: 'therapie',
      ownerMemberId: 'left-the-family',
      attendeeMemberIds: ['also-gone'],
    });

    const { byMember, shared } = splitByMember([hidden], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(shared).toEqual([]);
    for (const list of byMember.values()) expect(list).toEqual([]);
  });

  it('still renders the visible half of a partly hidden event', () => {
    // Dropping is about events with *no* visible participant. One rendered
    // member is enough to keep it, in that member's column only.
    const outing = event({
      key: 'outing',
      ownerMemberId: 'gone',
      attendeeMemberIds: ['mila'],
    });

    const { byMember, shared } = splitByMember([outing], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(byMember.get('mila')?.map((entry) => entry.key)).toEqual(['outing']);
    expect(shared).toEqual([]);
  });

  it('ignores events that do not touch the day', () => {
    const tomorrow = event({
      key: 'tomorrow',
      ownerMemberId: 'mila',
      startsAt: new Date('2026-03-11T09:00:00Z'),
      endsAt: new Date('2026-03-11T10:00:00Z'),
    });

    const { byMember, shared } = splitByMember([tomorrow], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(byMember.get('mila')).toEqual([]);
    expect(shared).toEqual([]);
  });

  it('keeps a multi-day event on every day it spans', () => {
    const camp = allDayEvent('kamp', '2026-03-09', '2026-03-12');
    const withOwner = { ...camp, ownerMemberId: 'daan' };

    for (const dayKey of ['2026-03-09', '2026-03-10', '2026-03-11']) {
      const { byMember } = splitByMember([withOwner], FAMILY, { timeZone: TZ, dayKey });
      expect(byMember.get('daan')?.map((entry) => entry.key)).toEqual(['kamp']);
    }
  });

  it('orders every bucket all-day first, then by start', () => {
    const whole = { ...allDayEvent('whole', '2026-03-10', '2026-03-11'), ownerMemberId: 'mila' };
    const morning = event({
      key: 'morning',
      ownerMemberId: 'mila',
      startsAt: new Date('2026-03-10T07:00:00Z'),
      endsAt: new Date('2026-03-10T08:00:00Z'),
    });
    const afternoon = event({ key: 'afternoon', ownerMemberId: 'mila' });

    const { byMember } = splitByMember([afternoon, morning, whole], FAMILY, {
      timeZone: TZ,
      dayKey: DAY,
    });
    expect(byMember.get('mila')?.map((entry) => entry.key)).toEqual([
      'whole',
      'morning',
      'afternoon',
    ]);
  });

  it('orders the shared lane the same way', () => {
    const whole = allDayEvent('whole', '2026-03-10', '2026-03-11');
    const afternoon = event({ key: 'afternoon' });

    const { shared } = splitByMember([afternoon, whole], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(shared.map((entry) => entry.key)).toEqual(['whole', 'afternoon']);
  });

  it('de-duplicates an event handed in twice', () => {
    const dinner = event({ key: 'dinner', ownerMemberId: 'mila' });
    const { byMember } = splitByMember([dinner, dinner], FAMILY, { timeZone: TZ, dayKey: DAY });
    expect(byMember.get('mila')).toHaveLength(1);
  });

  it('drops everything when no members are rendered at all', () => {
    // An unattributed event is still everyone's, so it stays shared.
    const mine = event({ key: 'mine', ownerMemberId: 'mila' });
    const ours = event({ key: 'ours' });

    const { byMember, shared } = splitByMember([mine, ours], [], { timeZone: TZ, dayKey: DAY });
    expect(byMember.size).toBe(0);
    expect(shared.map((entry) => entry.key)).toEqual(['ours']);
  });
});
