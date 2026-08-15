import type { IconName } from '@kynite/ui';
import type { RewardCategory } from '../schema';

/**
 * Design tokens for the rewards slice.
 *
 * Kept out of the components so the Server Actions can validate against the
 * same closed sets the pickers offer — an icon name that arrives in a form is
 * a string the client sent, and it has to land in the type-safe subset the
 * Material Symbols font actually ships (`pnpm icons:subset`).
 */

/**
 * The icons a reward may wear. Every entry is in the subset font, and the set
 * is what the whole catalogue is *about*: privileges and experiences. There is
 * no coin, no wallet, no piggy bank — not because they were left out, but
 * because no reward in this product is money (research §Decisions 8).
 */
export const REWARD_ICONS = [
  'redeem',
  'restaurant',
  'menu_book',
  'movie',
  'sports_esports',
  'cookie',
  'pets',
  'pool',
  'diversity_3',
  'icecream',
  'park',
  'palette',
] as const satisfies readonly IconName[];

export type RewardIcon = (typeof REWARD_ICONS)[number];

export const DEFAULT_REWARD_ICON: RewardIcon = 'redeem';

export function isRewardIcon(value: string): value is RewardIcon {
  return (REWARD_ICONS as readonly string[]).includes(value);
}

export function rewardIconOf(value: string | null): RewardIcon {
  return value && isRewardIcon(value) ? value : DEFAULT_REWARD_ICON;
}

/**
 * Tile colour per category, from the eight-colour category palette.
 *
 * Category is a *sorting* signal, not a status one: nothing here means "good"
 * or "bad", so the palette entries are picked for distinctness rather than
 * meaning, and red is absent from the set the way it is absent from the
 * celebration palette.
 */
export const CATEGORY_TILE: Record<RewardCategory, string> = {
  privilege: 'bg-cat-blue-surface text-cat-blue-fg',
  experience: 'bg-cat-purple-surface text-cat-purple-fg',
  treat: 'bg-cat-orange-surface text-cat-orange-fg',
};

/** The single-tap store tile height, matching the hub's 48px kiosk minimum. */
export const REWARD_TILE_MIN_HEIGHT = 200;
