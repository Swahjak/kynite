'use client';

import { useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { fireConfettiBurst } from '@/components/celebration';
import { Icon, RewardCard } from '@kynite/ui';
import { requestRedemptionAction } from '../actions';
import type { StoreData, StoreTile } from '../page-data';
import { CATEGORY_TILE } from './tokens';

/**
 * The child-facing shelf (M08's `(hub)/hub/store`).
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
 * The stars do not move when a tile is asked for. The tile says somebody is
 * looking at it and the balance in the header stays exactly where it was, which
 * is the truth: the price is frozen at the moment of asking and only spent when
 * a parent says yes.
 *
 * **One child at a time.** Whose shelf this is was decided by the page's chips;
 * nothing here can render a second child's anything (research §Decisions 3).
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

  return (
    <div data-testid="reward-store" data-horizon={store.horizon} className="flex flex-col gap-4">
      <h2 className="font-display text-h1 font-extrabold text-ink">{t('store.shelf')}</h2>

      {store.tiles.length === 0 ? (
        <p data-testid="store-empty" className="text-body-lg text-ink-secondary">
          {t('store.empty')}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {store.tiles.map((raw) => {
            const tile = withOptimistic(raw);
            return (
              <RewardCard
                key={tile.id}
                tile={tile}
                tileClass={CATEGORY_TILE[tile.category]}
                copy={{
                  cost: t('starsCost', { count: tile.costStars }),
                  shortHint: t('store.shortBy', { count: tile.starsShort }),
                  requestedLabel: t('store.asked'),
                  actionLabel: t('store.askFor', { title: tile.title }),
                  action: t('store.choose'),
                  category: t(`categories.${tile.category}`),
                }}
                onRequest={(origin) => request(tile, origin)}
              />
            );
          })}
        </ul>
      )}

      {/* What happens next, said once, in the board's neutral voice. It is the
          screen's only sentence about the parent, and it promises nothing on
          their behalf beyond "somebody will look". */}
      <p className="flex items-center gap-2.5 rounded-2xl bg-surface-container px-4.5 py-3.5 text-body-sm text-ink-secondary">
        <Icon name="info" size="sm" className="shrink-0 text-ink-muted" />
        {t('store.askNote')}
      </p>
    </div>
  );
}
