/**
 * The shape of a day: what is happening *now*, and what comes after it.
 *
 * Pure and framework-free (architecture §2 rule 2), and deliberately generic
 * over the block type: `/today` feeds it `CalendarEvent`s, but nothing here
 * needs to know that. A block is three facts — when it starts, when it ends,
 * and whether it has a clock at all — so the same functions serve a routine
 * occurrence or a timer the day it grows one.
 *
 * The rules are the ones a person reads off the mockup's NOW card
 * (`docs/design/stitch/.../today_s_flow_light_mode/code.html:20-56`):
 *
 * - "now" is a *timed* block you are inside. An all-day block is true all day
 *   and therefore says nothing about this minute — putting one in the hero with
 *   a progress ring would draw a ring that is 40% through "Vakantie".
 * - when two timed blocks overlap, the one finishing soonest wins. That is the
 *   one the ring's countdown is about: "8m remaining" has to be true of the
 *   thing on the card.
 * - the hero falls back to the next block when nothing is live, so a gap in the
 *   afternoon still has a subject.
 *
 * **Which day is being looked at is an input, not an inference.** Until M19 the
 * page smuggled it in through the `now` argument — the real clock for today,
 * that day's midnight for a browsed one — and everything downstream then read
 * a browsed day as "a today whose morning has not happened yet". A *past* day
 * came out as an empty flow ("nothing else planned"), which is a lie about a
 * day that was full. So the reference carries its own `kind`, and each kind
 * gets the presentation it deserves.
 */

export type TimeBlock = {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
};

/** How many tiles the "Up Next" grid holds before it stops listing. */
export const UP_NEXT_LIMIT = 4;

/**
 * Which day the flow is about, relative to the family's wall clock.
 *
 * - `today` — the live day. `now` is the real instant, and the countdown means
 *   something.
 * - `future` — a day being browsed that has not started. Everything on it is
 *   ahead, nothing is live, and no countdown language applies ("in 9 hours" is
 *   not what a parent is asking when they tap tomorrow).
 * - `past` — a day being browsed that is over. It is a record, not a plan.
 */
export type ReferenceKind = 'today' | 'future' | 'past';

export type DayReference = {
  kind: ReferenceKind;
  /** The instant to measure against. Only meaningful for `today`. */
  now: Date;
};

/**
 * How the hero should read.
 *
 * `live` and `next` only ever come from today, and only they carry countdown
 * language — a card that says "in 9 minutes" about tomorrow is wrong twice
 * over. A future day gets `preview` (the same block, stated rather than counted)
 * and a finished one gets `past`. `clear` is a day with nothing to show.
 */
export type FlowMode = 'live' | 'next' | 'preview' | 'past' | 'clear';

/**
 * Every timed block `now` falls inside, soonest-ending first.
 *
 * Half-open on the end (`start <= now < end`) so a block that ends at 09:00 and
 * one that starts at 09:00 never both count as current at 09:00 sharp. An
 * all-day block is never "current" — see the module note on why it cannot
 * lead the hero, which applies here just the same.
 *
 * Sort is stable, so two blocks ending at the same instant keep the order they
 * were given in — the same tie-break `currentBlock` used to make explicit with
 * its `<` comparison.
 */
export function currentBlocks<T extends TimeBlock>(blocks: readonly T[], now: Date): T[] {
  const instant = now.getTime();

  return blocks
    .filter(
      (block) =>
        !block.allDay && block.startsAt.getTime() <= instant && block.endsAt.getTime() > instant
    )
    .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
}

/**
 * The timed block `now` falls inside, or null — the one finishing soonest
 * when several overlap. `currentBlocks(blocks, now)[0] ?? null`.
 */
export function currentBlock<T extends TimeBlock>(blocks: readonly T[], now: Date): T | null {
  return currentBlocks(blocks, now)[0] ?? null;
}

/**
 * Timed blocks first, in clock order; all-day blocks after them.
 *
 * An all-day block has no clock, so it cannot take its turn in a queue of
 * times. Sorting it by its stored `startsAt` would put it at the head of every
 * list — all-day rows are persisted at midnight *UTC*, which for a household in
 * Amsterdam is 02:00 the same day and for one in Curaçao is 20:00 the day
 * before. Neither is a start time anybody experiences.
 */
function inDayOrder<T extends TimeBlock>(blocks: readonly T[]): T[] {
  return [...blocks].sort(
    (a, b) =>
      Number(a.allDay) - Number(b.allDay) ||
      a.startsAt.getTime() - b.startsAt.getTime() ||
      a.endsAt.getTime() - b.endsAt.getTime()
  );
}

/**
 * Everything still ahead on the live day, earliest first.
 *
 * All-day blocks are kept **by wall-day membership, not by comparing instants**:
 * the caller has already filtered `blocks` to the day being shown, so an all-day
 * block that is in the list is by definition true today. The old
 * `startsAt > now` test dropped every one of them from the moment the family's
 * local midnight passed the stored UTC midnight — i.e. all day, every day, in
 * every zone east of UTC. "Vakantie" was unreachable on the one day it mattered.
 */
export function upcomingBlocks<T extends TimeBlock>(blocks: readonly T[], now: Date): T[] {
  const instant = now.getTime();

  return inDayOrder(blocks.filter((block) => block.allDay || block.startsAt.getTime() > instant));
}

export type Flow<T extends TimeBlock> = {
  /** The block the hero card is about — live if there is one, else the next. */
  hero: T | null;
  /** True when `hero` is happening right now, which is what the ring measures. */
  live: boolean;
  /** What the hero should say: see `FlowMode`. */
  mode: FlowMode;
  /**
   * Every timed block live right now, soonest-ending first — `hero` is
   * `liveBlocks[0]` whenever `live` is true. Empty unless `mode === 'live'`:
   * a browsed day never has a "now", and a today with nothing live falls
   * hero back to what's next rather than inventing a live block.
   *
   * The featured "nu" strip draws one of these per overlapping event; the
   * timeline collapses the same keys behind its "already happened" disclosure
   * so the two surfaces never say the same thing twice.
   */
  liveBlocks: T[];
  /** The tiles under the hero — never repeats the hero. */
  upNext: T[];
};

export function flowOf<T extends TimeBlock>(
  blocks: readonly T[],
  reference: DayReference,
  limit: number = UP_NEXT_LIMIT
): Flow<T> {
  const cap = Math.max(0, limit);

  // A browsed day is a list, not a countdown. Future: the whole day is ahead,
  // so the first block leads and the rest follow. Past: the same list, framed
  // as what happened — nothing about it is "next".
  if (reference.kind !== 'today') {
    const ordered = inDayOrder(blocks);
    const hero = ordered[0] ?? null;

    return {
      hero,
      live: false,
      mode: hero === null ? 'clear' : reference.kind === 'past' ? 'past' : 'preview',
      liveBlocks: [],
      upNext: ordered.slice(1, 1 + cap),
    };
  }

  const currents = currentBlocks(blocks, reference.now);
  const current = currents[0] ?? null;
  const upcoming = upcomingBlocks(blocks, reference.now);
  const hero = current ?? upcoming[0] ?? null;

  return {
    hero,
    live: current !== null,
    mode: hero === null ? 'clear' : current !== null ? 'live' : 'next',
    liveBlocks: currents,
    upNext: upcoming.filter((block) => block !== hero).slice(0, cap),
  };
}

/**
 * How far through a block `now` is, as 0–1.
 *
 * Clamped at both ends, and 0 for a zero-length or all-day block: the ring is a
 * picture of elapsed time, and dividing by nothing is not one. A block that has
 * not started reads 0 rather than a negative sweep.
 */
export function elapsedRatio(block: TimeBlock, now: Date): number {
  if (block.allDay) return 0;

  const span = block.endsAt.getTime() - block.startsAt.getTime();
  if (span <= 0) return 0;

  const elapsed = now.getTime() - block.startsAt.getTime();
  return Math.min(1, Math.max(0, elapsed / span));
}

/**
 * Whole minutes left of a block, rounded *up* and never negative.
 *
 * Up, because "1m" on a card with 30 seconds left is the honest reading of a
 * countdown a family is acting on; `Math.floor` would show "0m" for the last
 * minute of every block in the product.
 */
export function minutesRemaining(block: TimeBlock, now: Date): number {
  return Math.max(0, Math.ceil((block.endsAt.getTime() - now.getTime()) / 60_000));
}

/** Whole minutes until a block starts, rounded up; 0 once it has. */
export function minutesUntil(block: TimeBlock, now: Date): number {
  return Math.max(0, Math.ceil((block.startsAt.getTime() - now.getTime()) / 60_000));
}

/**
 * How the STRAKS countdown should read, in the same three registers the
 * routines board already draws for its own upcoming chip
 * (`modules/routines/ui/routine-board.tsx`'s `countdownFor`): a duration close
 * in, and a clock time once a duration stops being a number anyone converts.
 *
 * Close in, a duration is what a family can act on: "over 40 min", "over 4
 * uur". Past six hours the block belongs to a *later part of today* rather
 * than to soon, so the reading switches to the clock time itself ("om
 * 19:30") — "over 396 min" is not a sentence a person reaches for about
 * something 6.5 hours away.
 *
 * Returns a discriminated reading rather than a formatted string: this module
 * stays framework-free (no `next-intl`), so the caller picks the message key
 * and, for `clock`, supplies the already-formatted time.
 */
export type StartsInReading =
  { kind: 'minutes'; minutes: number } | { kind: 'hours'; hours: number } | { kind: 'clock' };

export function startsInReading(block: TimeBlock, now: Date): StartsInReading {
  const minutes = minutesUntil(block, now);
  if (minutes <= 90) return { kind: 'minutes', minutes };
  if (minutes <= 360) return { kind: 'hours', hours: Math.round(minutes / 60) };
  return { kind: 'clock' };
}
