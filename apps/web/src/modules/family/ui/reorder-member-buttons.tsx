'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';
import { idleState } from '../action-state';
import { reorderMemberAction } from '../actions';

/**
 * Move a member up/down in board order (M1, adjustable member order).
 *
 * Two one-field forms rather than one form with two submit buttons: each
 * needs its own `useActionState` pending flag so pressing "up" does not also
 * disable "down" while its own request is in flight. `size="icon-hub"` is the
 * design system's 48px tap-target floor (`buttonVariants` in
 * `packages/ui/src/components/button.tsx`), same as every other kiosk-safe
 * control on this card.
 */
export function ReorderMemberButtons({
  memberId,
  canMoveUp,
  canMoveDown,
}: {
  memberId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const t = useTranslations('family');
  const [upState, upAction, upPending] = useActionState(reorderMemberAction, idleState);
  const [downState, downAction, downPending] = useActionState(reorderMemberAction, idleState);
  const errorState = upState.status === 'error' ? upState : downState;

  return (
    <span className="flex flex-wrap items-center gap-1">
      <form action={upAction} className="contents">
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="direction" value="up" />
        <Button
          type="submit"
          variant="ghost"
          size="icon-hub"
          disabled={!canMoveUp || upPending || downPending}
          aria-label={t('actions.moveUp')}
          data-testid="move-member-up"
        >
          <Icon name="arrow_upward" size="md" />
        </Button>
      </form>
      <form action={downAction} className="contents">
        <input type="hidden" name="memberId" value={memberId} />
        <input type="hidden" name="direction" value="down" />
        <Button
          type="submit"
          variant="ghost"
          size="icon-hub"
          disabled={!canMoveDown || downPending || upPending}
          aria-label={t('actions.moveDown')}
          data-testid="move-member-down"
        >
          <Icon name="arrow_downward" size="md" />
        </Button>
      </form>
      {errorState.status === 'error' ? (
        <span role="alert" className="text-body-sm text-destructive">
          {t(`errors.${errorState.error}`)}
        </span>
      ) : null}
    </span>
  );
}
