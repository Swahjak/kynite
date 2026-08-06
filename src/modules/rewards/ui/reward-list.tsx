import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import type { Member } from '@/modules/family';
import type { RewardPreset } from '../domain/economy';
import type { Reward } from '../schema';
import { DeleteRewardButton } from './delete-reward-button';
import { RewardDialog } from './reward-dialog';
import { SeedPresetsButton } from './seed-presets-button';
import { rewardIconOf } from './tokens';

/**
 * The parent's reward catalogue.
 *
 * Deliberately *not* a status board, for the same reason the routine roster is
 * not one: it shows what is on the shelf — what it costs, whose it is, what
 * kind of thing it is — and never who has how many stars. Balances belong to
 * each child's own chart, and no screen in this product puts two of them
 * together (research §Decisions 3).
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
    <ul className="flex flex-col gap-3">
      {rewards.map((reward) => (
        <li key={reward.id}>
          <Card data-testid="reward-row" data-reward-id={reward.id}>
            <CardContent className="flex flex-wrap items-start gap-4">
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-ink-secondary"
              >
                <Icon name={rewardIconOf(reward.icon)} size="lg" />
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="font-display text-h3 font-bold">{reward.title}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge variant="gold">{t('starsCost', { count: reward.costStars })}</Badge>
                  <Badge variant="secondary">{t(`categories.${reward.category}`)}</Badge>
                  {reward.availableToMemberIds.length === 0 ? (
                    <Badge variant="outline">{t('availableToEveryone')}</Badge>
                  ) : (
                    reward.availableToMemberIds.map((memberId) => (
                      <Badge key={memberId} variant="outline">
                        {nameOf(memberId)}
                      </Badge>
                    ))
                  )}
                  {reward.active ? null : <Badge variant="ghost">{t('inactive')}</Badge>}
                </span>
              </div>

              {canWrite ? (
                <span className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
                  <RewardDialog members={assignableMembers} reward={reward} />
                  <DeleteRewardButton rewardId={reward.id} title={reward.title} />
                </span>
              ) : null}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
