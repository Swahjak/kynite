'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { idleState } from '../action-state';
import { deleteRewardAction } from '../actions';

/**
 * Removing a reward is a *parent* action on the parent surface, so it behaves
 * like every other destructive control in the app — which since M18 means it
 * asks first (`ConfirmButton`, the M12 two-tap shape).
 *
 * Note what it is not: there is no equivalent anywhere on the hub, and taking a
 * reward off the shelf never touches the star ledger. If anything, it gives
 * stars *back* — a deleted reward's approved redemptions go with it, so their
 * cost stops being subtracted and the child's available balance can only rise.
 * Earned stars are untouched either way.
 */
export function DeleteRewardButton({
  rewardId,
  title,
  compact = false,
}: {
  rewardId: string;
  title: string;
  /** The icon-only trigger a dense list row uses. */
  compact?: boolean;
}) {
  const t = useTranslations('rewards');
  const [state, formAction, pending] = useActionState(deleteRewardAction, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="rewardId" value={rewardId} />
      {/* Short visible label, full accessible name: a shelf of rewards would
          otherwise be a column of long, near-identical buttons. */}
      <ConfirmButton
        triggerLabel={t('actions.removeNamed', { title })}
        question={t('actions.removeConfirm')}
        confirmLabel={t('actions.removeConfirmYes')}
        pending={pending}
        compact={compact}
        testId="delete-reward"
      >
        {t('actions.remove')}
      </ConfirmButton>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
