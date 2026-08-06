/**
 * The star economy, as pure arithmetic.
 *
 * Every number a child sees about their own stars is derived here, in one
 * place, because the two numbers involved are easy to conflate and the whole
 * design rests on them staying distinct:
 *
 *   - **earned** — the running total of the append-only `star_ledger`. It only
 *     ever goes up. This is the number a young child watches grow (research
 *     §Decisions 2: cumulative total as the primary metric), and nothing in
 *     the product can lower it.
 *   - **available** — earned minus the cost of redemptions that were actually
 *     granted. This is the number the store spends against.
 *
 * Spending moves *available* and never touches *earned*. `member_star_balance`
 * computes both in SQL; the functions here are what the UI renders, and they
 * are deliberately total (no throwing, no negatives escaping) so a surprising
 * row in the database cannot produce a negative star count on a wall display.
 */

import type { RewardCategory } from '../schema';

export type StarTotals = {
  /** Monotonic. Everything ever awarded. */
  earned: number;
  /** Everything spent on granted redemptions. */
  spent: number;
  /** `earned - spent`, floored at zero. */
  available: number;
};

/** Whole, non-negative, never `NaN` — the shape every star number must have. */
function whole(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/**
 * Normalise a balance row into the two numbers the UI renders.
 *
 * `available` is floored at zero rather than allowed to go negative. A negative
 * balance is not a state this system can legitimately reach — approval checks
 * affordability first — and if one ever appeared (a hand-edited row, a
 * concurrent approval that raced), showing a child "-3 stars" would be exactly
 * the negative marking research §Decisions 1 forbids. It renders as zero and
 * the parent's approval queue is where the discrepancy would surface.
 */
export function starTotals(input: { earned: number; spent: number }): StarTotals {
  const earned = whole(input.earned);
  const spent = whole(input.spent);
  return { earned, spent, available: Math.max(0, earned - spent) };
}

/** How many more stars this costs than the child has. 0 once affordable. */
export function starsShort(costStars: number, availableStars: number): number {
  return Math.max(0, whole(costStars) - whole(availableStars));
}

export function canAfford(costStars: number, availableStars: number): boolean {
  return starsShort(costStars, availableStars) === 0;
}

/**
 * How a reward tile renders in the store.
 *
 * Three states, and the missing fourth is the point: there is no "denied" or
 * "unavailable" tile. `outOfReach` is a *dimmed* tile with a forward-looking
 * hint ("7 more stars"), never a mark — the same single-opacity treatment the
 * routine board uses for a step that has not happened yet.
 */
export type RewardState = 'affordable' | 'outOfReach' | 'requested';

export function rewardStateOf(input: {
  costStars: number;
  availableStars: number;
  requested: boolean;
}): RewardState {
  if (input.requested) return 'requested';
  return canAfford(input.costStars, input.availableStars) ? 'affordable' : 'outOfReach';
}

export type Goal = {
  rewardId: string;
  title: string;
  costStars: number;
  /** Stars already banked towards it — capped at the cost, never over 100%. */
  progressStars: number;
  remainingStars: number;
  /** 0..1, for the progress bar's width. */
  ratio: number;
};

export type GoalCandidate = { id: string; title: string; costStars: number };

/**
 * The featured savings goal for a `savings`-horizon child (ages ~8–12).
 *
 * The **nearest** reward they cannot yet afford, not the most expensive one.
 * A goal only motivates while it looks reachable (research §"Age
 * differentiation": delay tolerance improves with age but is still finite),
 * and the nearest one is always the one closest to arriving. Ties break on the
 * catalogue's own order, so the parent's ordering decides.
 *
 * `null` when everything on the child's shelf is already affordable — the
 * correct UI then is the store itself, not a goal card at 100% that suggests
 * there is something left to wait for.
 */
export function savingsGoalOf(
  rewards: readonly GoalCandidate[],
  availableStars: number
): Goal | null {
  const available = whole(availableStars);

  const nearest = rewards
    .filter((reward) => whole(reward.costStars) > available)
    .reduce<GoalCandidate | null>((best, reward) => {
      if (!best) return reward;
      return whole(reward.costStars) < whole(best.costStars) ? reward : best;
    }, null);

  if (!nearest) return null;

  const cost = whole(nearest.costStars);
  const progress = Math.min(available, cost);

  return {
    rewardId: nearest.id,
    title: nearest.title,
    costStars: cost,
    progressStars: progress,
    remainingStars: cost - progress,
    ratio: cost === 0 ? 1 : progress / cost,
  };
}

/**
 * The starter catalogue (research §Decisions 8, FR16).
 *
 * Privileges and experiences, with a small "treat" tier — and **no money**.
 * Paying for household contribution reframes family membership as a labor
 * transaction (research §"Rewards economy"), so the category does not exist in
 * the enum, in these presets, or anywhere a parent can type one: the catalogue
 * form offers the three categories the database constrains and nothing else.
 *
 * Costs are deliberately small and close together. A preset shelf where the
 * cheapest thing costs 30 stars is a shelf a four-year-old never reaches.
 */
export type RewardPreset = {
  /** Translation key under `rewards.presets`. */
  key: string;
  category: RewardCategory;
  icon: string;
  costStars: number;
};

export const REWARD_PRESETS: readonly RewardPreset[] = [
  { key: 'chooseDinner', category: 'privilege', icon: 'restaurant', costStars: 5 },
  { key: 'extraStory', category: 'privilege', icon: 'menu_book', costStars: 3 },
  { key: 'pickMovie', category: 'privilege', icon: 'movie', costStars: 10 },
  { key: 'extraPlayTime', category: 'privilege', icon: 'sports_esports', costStars: 8 },
  { key: 'bakeTogether', category: 'experience', icon: 'cookie', costStars: 8 },
  { key: 'zooTrip', category: 'experience', icon: 'pets', costStars: 30 },
  { key: 'swimming', category: 'experience', icon: 'pool', costStars: 20 },
  { key: 'friendOver', category: 'experience', icon: 'diversity_3', costStars: 15 },
  { key: 'favouriteSnack', category: 'treat', icon: 'icecream', costStars: 4 },
] as const;
