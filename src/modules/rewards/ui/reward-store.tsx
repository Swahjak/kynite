'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fireConfettiBurst } from '@/components/celebration';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { requestRedemptionAction } from '../actions';
import type { StoreData, StoreTile } from '../page-data';
import { RewardCard } from './reward-card';
import { SavingsGoalCard } from './savings-goal-card';

/**
 * The child-facing reward store (M08's `(hub)/hub/store`).
 *
 * This component owns the client half of the request flow, and it is the same
 * shape as the completion flow the routine board runs (§4):
 *
 * ```
 * tap ─ tile flips to "asked" ─ gentle celebration ─ Server Action
 * ```
 *
 * with no await before the flip and no spinner anywhere. `pending` from
 * `useTransition` is deliberately not destructured: there is nothing to render
 * while it is true, because the child has already seen the answer to "did my
 * tap register" — which is a different question from "did I get the reward",
 * and only the first one is the app's to answer instantly.
 *
 * **Two horizons, one component.** `instant` (ages ~4–7) renders icon-first
 * tiles and nothing else: no goal card, no totals-over-time, no text a
 * pre-reader has to decode. `savings` (ages ~8–12) adds the featured goal with
 * its progress bar. The split is a per-child setting, not a guess from a
 * birthday, and it changes *what exists on the screen* rather than restyling
 * the same content — a four-year-old given a progress bar towards something a
 * week away is given a bar that does not appear to move.
 *
 * **One child at a time.** The chips switch whose shelf is shown; they carry a
 * name and a colour and nothing else. There is no arrangement of this screen
 * that puts two children's numbers side by side (research §Decisions 3).
 */
export function RewardStore({ store }: { store: StoreData }) {
  const t = useTranslations('rewards');

  const [optimisticRequested, addOptimisticRequest] = useOptimistic<ReadonlySet<string>, string>(
    new Set<string>(),
    (previous, rewardId) => new Set(previous).add(rewardId)
  );
  const [, startTransition] = useTransition();

  const withOptimistic = (tile: StoreTile): StoreTile =>
    optimisticRequested.has(tile.id) ? { ...tile, state: 'requested', starsShort: 0 } : tile;

  const request = (tile: StoreTile, origin: { x: number; y: number }) => {
    if (tile.state !== 'affordable' || !store.canRequest) return;

    startTransition(async () => {
      addOptimisticRequest(tile.id);
      // `gentle`, not `big`: asking is not receiving. The big celebration is
      // reserved for the moment a parent says yes.
      fireConfettiBurst({ intensity: 'gentle', origin });

      await requestRedemptionAction({
        rewardId: tile.id,
        memberId: store.member.id,
        clientId: tile.clientId,
      });
    });
  };

  const savings = store.horizon === 'savings';

  return (
    <div data-testid="reward-store" data-horizon={store.horizon} className="flex flex-col gap-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        {store.chips.length > 1 ? (
          <nav
            data-testid="store-chips"
            aria-label={t('store.chooseMember')}
            className="flex w-max flex-row items-center gap-2 rounded-4xl bg-muted p-2"
          >
            {store.chips.map((chip) => {
              const active = chip.id === store.member.id;
              return (
                <Link
                  key={chip.id}
                  href={{ pathname: '/hub/store', query: { member: chip.id } }}
                  data-testid="store-chip"
                  data-member-id={chip.id}
                  data-active={active ? 'true' : 'false'}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-14 min-w-12 items-center gap-3 rounded-4xl px-6 font-display text-body-lg font-medium transition-colors',
                    active
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  {/* The face, rendered from strings the server resolved: this
                      is a client module, and reaching into `@/modules/family`
                      for the colour map here would ship `pg` to the browser. */}
                  {chip.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={chip.avatarUrl}
                      alt=""
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full text-caption font-bold',
                        chip.colorClass
                      )}
                    >
                      {chip.initials}
                    </span>
                  )}
                  {chip.displayName}
                </Link>
              );
            })}
          </nav>
        ) : null}

        {/* The one number this screen is about, and it belongs to exactly one
            child. `available`, not `earned`: this is what the shelf spends. */}
        <div
          data-testid="star-balance"
          data-member-id={store.member.id}
          className="flex w-max items-center gap-4 rounded-4xl bg-gold/20 px-8 py-4 text-gold-ink"
        >
          <Icon name="star" size="2xl" filled />
          <span className="flex flex-col gap-1">
            <span
              data-testid="available-stars"
              className="font-display text-display-md font-extrabold tabular-time"
            >
              {store.totals.available}
            </span>
            <span className="label-overline">{t('store.availableStars')}</span>
          </span>
        </div>
      </div>

      {savings && store.goal ? (
        <SavingsGoalCard
          goal={store.goal}
          icon={store.tiles.find((tile) => tile.id === store.goal!.rewardId)?.icon ?? null}
          copy={{
            eyebrow: t('store.currentGoal'),
            remaining: t('store.starsToGo', { count: store.goal.remainingStars }),
            progress: t('store.goalProgress', {
              have: store.goal.progressStars,
              need: store.goal.costStars,
            }),
          }}
        />
      ) : null}

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-h2 font-bold text-foreground">{t('store.shelf')}</h2>

        {store.tiles.length === 0 ? (
          <p data-testid="store-empty" className="text-body-lg text-ink-secondary">
            {t('store.empty')}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {store.tiles.map((raw) => {
              const tile = withOptimistic(raw);
              return (
                <RewardCard
                  key={tile.id}
                  tile={tile}
                  copy={{
                    cost: t('starsCost', { count: tile.costStars }),
                    shortHint: t('store.moreStars', { count: tile.starsShort }),
                    requestedLabel: t('store.asked'),
                    actionLabel: t('store.askFor', { title: tile.title }),
                  }}
                  onRequest={(origin) => request(tile, origin)}
                />
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
