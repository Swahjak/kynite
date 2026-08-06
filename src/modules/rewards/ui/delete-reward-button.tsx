'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { idleState } from '../action-state';
import { deleteRewardAction } from '../actions';

/**
 * Removing a reward is a *parent* action on the parent surface, so it behaves
 * like every other destructive control in the app.
 *
 * Note what it is not: there is no equivalent anywhere on the hub, and taking a
 * reward off the shelf never touches the star ledger. If anything, it gives
 * stars *back* — a deleted reward's approved redemptions go with it, so their
 * cost stops being subtracted and the child's available balance can only rise.
 * Earned stars are untouched either way.
 */
export function DeleteRewardButton({ rewardId, title }: { rewardId: string; title: string }) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(deleteRewardAction, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="rewardId" value={rewardId} />
      {/* Short visible label, full accessible name: a shelf of rewards would
          otherwise be a column of long, near-identical buttons. */}
      <Button
        type="submit"
        variant="destructive"
        size="hub"
        aria-label={t('actions.removeNamed', { title })}
        disabled={pending}
      >
        {t('actions.remove')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
