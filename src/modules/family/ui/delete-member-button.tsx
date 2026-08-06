'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { idleState } from '../action-state';
import { deleteMemberAction } from '../actions';

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
      <Button
        type="submit"
        variant="destructive"
        size="icon-hub"
        disabled={pending}
        aria-label={t('actions.removeNamed', { name: displayName })}
        title={state.status === 'error' ? t(`errors.${state.error}`) : undefined}
      >
        <Icon name="delete" size="md" />
      </Button>
    </form>
  );
}
