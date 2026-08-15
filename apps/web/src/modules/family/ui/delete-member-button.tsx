'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Icon } from '@kynite/ui';
import { idleState } from '../action-state';
import { deleteMemberAction } from '../actions';

/**
 * Removing someone from the household (M18: asks first).
 *
 * The most consequential of the three list deletions and the one that was
 * previously a single icon tap: a member row takes its routines, its
 * completions and its whole star history with it (`onDelete: 'cascade'`), and
 * a bare trash glyph next to an avatar is exactly the control a thumb finds by
 * accident on a phone.
 */
export function DeleteMemberButton({
  memberId,
  displayName,
}: {
  memberId: string;
  displayName: string;
}) {
  const t = useTranslations('family');
  const [state, formAction, pending] = useActionState(deleteMemberAction, idleState);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="memberId" value={memberId} />
      <ConfirmButton
        triggerLabel={t('actions.removeNamed', { name: displayName })}
        question={t('actions.removeConfirm')}
        confirmLabel={t('actions.removeConfirmYes')}
        pending={pending}
        testId="delete-member"
      >
        <Icon name="delete" size="md" />
      </ConfirmButton>
      {/* The error had nowhere to go but a `title` on the old icon button,
          which a touch device never shows. */}
      {state.status === 'error' ? (
        <span role="alert" className="text-body-sm text-destructive">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
