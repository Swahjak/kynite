import { describe, expect, it } from 'vitest';
import {
  REWARD_PRESETS,
  canAfford,
  rewardStateOf,
  savingsGoalOf,
  starTotals,
  starsShort,
} from '@/modules/rewards/domain/economy';
import { REWARD_CATEGORIES, rewardCategory } from '@/modules/rewards/schema';

/**
 * The star arithmetic, and the two invariants it exists to keep apart:
 * "stars earned" is monotonic, "stars available" is derived.
 */

describe('starTotals', () => {
  it('derives available as earned minus spent', () => {
    expect(starTotals({ earned: 12, spent: 5 })).toEqual({
      earned: 12,
      spent: 5,
      available: 7,
    });
  });

  it('keeps earned unchanged as spending grows — the monotonic half', () => {
    const earned = 40;

    const spendingMore = [0, 5, 20, 40].map((spent) => starTotals({ earned, spent }));

    // Every reading reports the same earned total. The child's history does not
    // shrink because they chose something from the shelf.
    expect(spendingMore.map((totals) => totals.earned)).toEqual([40, 40, 40, 40]);
    // Only the derived number moves.
    expect(spendingMore.map((totals) => totals.available)).toEqual([40, 35, 20, 0]);
  });

  it('never reports a negative balance, however the row got there', () => {
    // Not reachable through the actions (approval checks affordability inside
    // the transaction), but a wall display must not be able to render "-3".
    expect(starTotals({ earned: 2, spent: 5 }).available).toBe(0);
    expect(starTotals({ earned: 2, spent: 5 }).earned).toBe(2);
  });

  it('is total: a NaN, a fraction or a negative row degrades to zero', () => {
    expect(starTotals({ earned: Number.NaN, spent: 0 })).toEqual({
      earned: 0,
      spent: 0,
      available: 0,
    });
    expect(starTotals({ earned: -10, spent: 0 }).earned).toBe(0);
    expect(starTotals({ earned: 7.9, spent: 0 }).earned).toBe(7);
  });
});

describe('affordability', () => {
  it('counts up to the reward, never down from a shortfall', () => {
    expect(starsShort(30, 23)).toBe(7);
    expect(starsShort(5, 5)).toBe(0);
    // Already affordable: zero, not a negative "surplus".
    expect(starsShort(5, 40)).toBe(0);
  });

  it('affords exactly at the price', () => {
    expect(canAfford(10, 10)).toBe(true);
    expect(canAfford(10, 9)).toBe(false);
  });
});

describe('rewardStateOf', () => {
  it('is vivid when affordable', () => {
    expect(rewardStateOf({ costStars: 5, availableStars: 8, requested: false })).toBe('affordable');
  });

  it('is dimmed-with-a-hint when out of reach', () => {
    expect(rewardStateOf({ costStars: 50, availableStars: 8, requested: false })).toBe(
      'outOfReach'
    );
  });

  it('shows the request over everything else, affordable or not', () => {
    // A pending ask is the whole story of that tile: the price no longer
    // decides how it renders, so a star spent elsewhere mid-wait cannot flip
    // an "asked" tile back to a tappable one.
    expect(rewardStateOf({ costStars: 5, availableStars: 8, requested: true })).toBe('requested');
    expect(rewardStateOf({ costStars: 50, availableStars: 0, requested: true })).toBe('requested');
  });

  it('has no state for denial — a denied tile is an ordinary tile again', () => {
    // There is no fourth value to assert; this pins the union's size so adding
    // a "denied"/"locked" state becomes a deliberate act rather than a slip.
    const states = new Set(
      [
        rewardStateOf({ costStars: 1, availableStars: 1, requested: false }),
        rewardStateOf({ costStars: 9, availableStars: 1, requested: false }),
        rewardStateOf({ costStars: 1, availableStars: 1, requested: true }),
      ].map(String)
    );

    expect([...states].sort()).toEqual(['affordable', 'outOfReach', 'requested']);
  });
});

describe('savingsGoalOf', () => {
  const shelf = [
    { id: 'a', title: 'Extra story', costStars: 3 },
    { id: 'b', title: 'Pick the film', costStars: 10 },
    { id: 'c', title: 'Zoo trip', costStars: 30 },
  ];

  it('features the nearest unaffordable reward, not the biggest one', () => {
    const goal = savingsGoalOf(shelf, 5);

    expect(goal).toMatchObject({ rewardId: 'b', costStars: 10, remainingStars: 5 });
    expect(goal?.ratio).toBeCloseTo(0.5);
  });

  it('moves on to the next goal once the near one is affordable', () => {
    expect(savingsGoalOf(shelf, 12)?.rewardId).toBe('c');
  });

  it('is null when the whole shelf is already within reach', () => {
    // A 100%-full bar towards something already buyable would suggest there is
    // still something to wait for. The store itself is the right UI then.
    expect(savingsGoalOf(shelf, 30)).toBeNull();
  });

  it('never exceeds 100%, and reports progress against the goal only', () => {
    const goal = savingsGoalOf([{ id: 'z', title: 'Big', costStars: 100 }], 99);

    expect(goal).toMatchObject({ progressStars: 99, remainingStars: 1 });
    expect(goal!.ratio).toBeLessThanOrEqual(1);
  });

  it('is null for an empty shelf', () => {
    expect(savingsGoalOf([], 5)).toBeNull();
  });
});

/**
 * FR16 / research §Decisions 8. The strongest form of this assertion is that
 * the *enum* has no money member — a category the database cannot store is a
 * category no UI can offer, no form can smuggle in and no seed can create.
 */
describe('there is no money category, anywhere', () => {
  const MONEY = /money|allowance|cash|pocket|euro|dollar|zakgeld|geld|salary|pay/i;

  it('constrains the category enum to privilege | experience | treat', () => {
    expect([...REWARD_CATEGORIES].sort()).toEqual(['experience', 'privilege', 'treat']);
    expect([...rewardCategory.enumValues].sort()).toEqual(['experience', 'privilege', 'treat']);
  });

  it('has no money-shaped enum value', () => {
    for (const category of REWARD_CATEGORIES) {
      expect(category, `"${category}" reads as money`).not.toMatch(MONEY);
    }
  });

  it('ships no money-shaped preset', () => {
    expect(REWARD_PRESETS.length).toBeGreaterThanOrEqual(6);

    for (const preset of REWARD_PRESETS) {
      expect(preset.key, `preset "${preset.key}" reads as money`).not.toMatch(MONEY);
      expect(preset.icon, `preset icon "${preset.icon}" reads as money`).not.toMatch(
        /coin|wallet|savings|payments|attach_money|euro|account_balance/i
      );
      expect(REWARD_CATEGORIES).toContain(preset.category);
    }
  });

  it('keeps the presets reachable for the youngest tier', () => {
    // A shelf whose cheapest item costs 30 stars is a shelf a four-year-old on
    // the `instant` horizon never reaches (research §"Age differentiation").
    const cheapest = Math.min(...REWARD_PRESETS.map((preset) => preset.costStars));
    expect(cheapest).toBeLessThanOrEqual(5);
  });

  it('offers privileges and experiences, not only treats', () => {
    const categories = new Set(REWARD_PRESETS.map((preset) => preset.category));
    expect(categories.has('privilege')).toBe(true);
    expect(categories.has('experience')).toBe(true);
  });
});
