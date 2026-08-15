import { getTranslations } from 'next-intl/server';
import { cn, Icon, IconMedallion, StarCount } from '@kynite/ui';
import type { Member } from '@/modules/family';
import type { RewardPreset } from '../domain/economy';
import type { Reward } from '../schema';
import { DeleteRewardButton } from './delete-reward-button';
import { RewardDialog } from './reward-dialog';
import { SeedPresetsButton } from './seed-presets-button';
import { CATEGORY_TILE, rewardIconOf } from './tokens';

/**
 * The parent's reward catalogue (`Beloningen.dc.html`, tab "Catalogus").
 *
 * Deliberately *not* a status board, for the same reason the routine list is
 * not one: it shows what is on the shelf — what it costs, whose it is, what
 * kind of thing it is — and never who has how many stars. Balances are the
 * "Saldo" tab's business, and no child-facing surface can reach either
 * (research §Decisions 3).
 *
 * One row per reward rather than a grid of tiles: the child's store is where a
 * reward gets to look like an offer, and a parent scanning fourteen of them for
 * the one whose price is wrong is reading a list.
 *
 * The empty state offers the presets rather than an empty form. A shelf a
 * parent has to invent from nothing is the setup ritual that Fair Play's
 * critics identify as the failure mode (research §"Mental load"): one tap
 * produces nine sensible privileges and experiences, all editable, none of
 * them money.
 */
export async function RewardList({
  rewards,
  members,
  assignableMembers,
  presets,
  canWrite,
}: {
  rewards: Reward[];
  members: Member[];
  /** The children a reward can be restricted to. */
  assignableMembers: Member[];
  presets: readonly RewardPreset[];
  canWrite: boolean;
}) {
  const t = await getTranslations('rewards');
  const nameOf = (memberId: string) =>
    members.find((member) => member.id === memberId)?.displayName ?? '';

  if (rewards.length === 0) {
    return (
      <div data-testid="rewards-empty" className="flex flex-col items-start gap-4">
        <p className="text-body-lg text-ink-secondary">{t('empty')}</p>
        {canWrite ? (
          <SeedPresetsButton
            presets={presets.map((preset) => ({
              title: t(`presets.${preset.key}`),
              icon: preset.icon,
              costStars: preset.costStars,
              category: preset.category,
            }))}
          />
        ) : null}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rewards.map((reward) => (
        <li
          key={reward.id}
          data-testid="reward-row"
          data-reward-id={reward.id}
          className={cn(
            'flex items-center gap-2.5 rounded-2xl border border-line-subtle bg-card px-3.5 py-3',
            // Dimming, not a badge-only signal: an inactive reward is off the
            // shelf, and the row says so the same quiet way the store does.
            reward.active ? undefined : 'opacity-70'
          )}
        >
          <IconMedallion
            icon={rewardIconOf(reward.icon)}
            tint="none"
            shape="squircle"
            size="md"
            className={CATEGORY_TILE[reward.category]}
          />

          <div className="min-w-0 flex-1">
            <span className="block truncate text-body-sm font-semibold">{reward.title}</span>
            <span className="block truncate text-caption text-ink-secondary">
              {t(`categories.${reward.category}`)} ·{' '}
              {reward.availableToMemberIds.length === 0
                ? t('availableToEveryone')
                : reward.availableToMemberIds.map(nameOf).join(', ')}
              {reward.active ? '' : ` · ${t('inactive')}`}
            </span>
          </div>

          <StarCount
            value={reward.costStars}
            srLabel={t('starsCost', { count: reward.costStars })}
            size="sm"
          />

          {canWrite ? (
            <span className="flex shrink-0 items-center">
              <RewardDialog members={assignableMembers} reward={reward} compact />
              <DeleteRewardButton rewardId={reward.id} title={reward.title} compact />
            </span>
          ) : (
            <Icon name="chevron_right" size="sm" className="shrink-0 text-ink-muted" />
          )}
        </li>
      ))}
    </ul>
  );
}
