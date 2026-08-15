/**
 * How many stars a completion is worth.
 *
 * One function, because the fade path (research §Decisions 7, FR17) has to be
 * a single decision made in a single place: a routine that has graduated stops
 * paying stars *for that routine only*, and nothing else about it changes. The
 * child loses nothing — no star is ever removed, the ledger is append-only —
 * the routine simply stops adding to it, and wears a graduation badge instead.
 *
 * Returning 0 rather than "skip the award" keeps the caller branch-free: the
 * completion transaction inserts a `star_ledger` row only when this is > 0,
 * which is also what `CHECK (amount > 0)` requires (M04).
 */

export type Awardable = {
  starsPerCompletion: number;
  rewardEnabled: boolean;
  fadedAt: Date | null;
};

export function starsFor(routine: Awardable): number {
  if (!routine.rewardEnabled || routine.fadedAt !== null) return 0;
  if (!Number.isFinite(routine.starsPerCompletion)) return 0;
  return Math.max(0, Math.trunc(routine.starsPerCompletion));
}

/** True once a routine has graduated — the badge, not a downgrade. */
export function hasGraduated(routine: Awardable): boolean {
  return !routine.rewardEnabled || routine.fadedAt !== null;
}
