/**
 * Praise selection — the *headline* of completion feedback (FR15,
 * research §Decisions 5).
 *
 * Two rules shape everything in this file.
 *
 * **Praise leads, the star follows.** Verbal praise is the one reinforcement
 * the overjustification literature finds no cost in (Deci, Koestner & Ryan);
 * the star is the part that has to be handled carefully. So the praise line is
 * the visual headline and the star is secondary — asserted by a DOM-order test
 * and a visual snapshot, not left to a component's discretion.
 *
 * **Neutral board voice.** The hub is a board, never a parent's mouthpiece
 * (research §"Nagging / device as messenger"). The lines below are addressed
 * to the child about their own competence — "you did that by yourself" — and
 * never carry an instruction, an expectation, or an attributed speaker.
 *
 * Selection is *deterministic*: the same completion always shows the same
 * line. Randomness would make visual snapshots flap, and — more importantly —
 * would make a child's own screen change under them on a re-render.
 */

/** Translation keys under `routines.praise.*`, in `messages/{nl,en}.json`. */
export const PRAISE_KEYS = [
  'byYourself',
  'wellDone',
  'niceWork',
  'thatWasQuick',
  'goodThinking',
  'keptGoing',
] as const;

export type PraiseKey = (typeof PRAISE_KEYS)[number];

/** Translation keys under `routines.routineDone.*` — the calm success state. */
export const ROUTINE_DONE_KEYS = ['allDone', 'wholeRoutine', 'everyStep'] as const;

export type RoutineDoneKey = (typeof ROUTINE_DONE_KEYS)[number];

/**
 * FNV-1a. A hash, not a random number: the point is that `seed` maps to the
 * same line forever, on every device, in every locale.
 */
function hash(seed: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function pick<T>(options: readonly T[], seed: string): T {
  return options[hash(seed) % options.length];
}

/**
 * The praise line for one completed step. Seeded by the completion's own
 * identity (step + day), so re-rendering, reloading and replaying all show the
 * same words.
 */
export function praiseKeyFor(seed: string): PraiseKey {
  return pick(PRAISE_KEYS, seed);
}

/** The line a fully-completed routine collapses to. */
export function routineDoneKeyFor(seed: string): RoutineDoneKey {
  return pick(ROUTINE_DONE_KEYS, seed);
}

/** The canonical seed: stable across devices, unique per completion. */
export function completionSeed(input: {
  memberId: string;
  routineStepId: string;
  occurrenceDate: string;
}): string {
  return `${input.memberId}:${input.routineStepId}:${input.occurrenceDate}`;
}
