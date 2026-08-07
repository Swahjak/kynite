import { randomUUID } from 'node:crypto';

import { completionSeed, praiseKeyFor, type PraiseKey } from '@/modules/routines/domain/praise';

/**
 * Unique ids that still produce a *chosen* praise line (M17).
 *
 * The praise a completed step shows is `pick(PRAISE_KEYS, memberId:stepId:date)`
 * — a hash, deliberately, so the same completion always says the same thing
 * (`domain/praise.ts`). That leaves a visual baseline with two bad options: fix
 * the ids and pin the words, which makes the rows globally unique and collides
 * with any concurrent copy of the same test (`--repeat-each=2`); or randomise
 * the ids and let the words change on every run, which makes the baseline flap.
 *
 * There is a third option, which is this one: keep the ids random — a fresh
 * uuid per attempt, colliding with nothing — and *search* for a pair whose hash
 * lands on the praise line the baseline was taken with. The search is a few
 * dozen iterations against a six-element list, it is pure arithmetic, and it
 * uses the product's own function rather than a copy of it, so a change to the
 * hash cannot silently desynchronise this from the app.
 *
 * The occurrence date is an input, which is what lets a spec tap *today's*
 * occurrence (the only one the server will accept — a completion outside the
 * grace window is refused) and still screenshot fixed words.
 */
export function idsForPraise(
  wanted: PraiseKey,
  occurrenceDate: string
): { memberId: string; routineStepId: string } {
  const memberId = randomUUID();

  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const routineStepId = randomUUID();
    const seed = completionSeed({ memberId, routineStepId, occurrenceDate });
    if (praiseKeyFor(seed) === wanted) return { memberId, routineStepId };
  }

  throw new Error(`idsForPraise: no id produced praise "${wanted}" for ${occurrenceDate}`);
}
