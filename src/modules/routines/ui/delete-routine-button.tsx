'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { idleState } from '../action-state';
import { deleteRoutineAction } from '../actions';

/**
 * Deleting a routine is a *parent* action on the parent surface, so it behaves
 * like every other destructive control in the app — which since M18 means it
 * asks first (`ConfirmButton`, the two-tap shape M12 introduced for revoking a
 * device). A routine carries a household's whole morning; one stray tap in a
 * list of near-identical rows should not be able to take it. Note what it is
 * not: there
 * is no equivalent anywhere on the hub, and removing a routine never touches
 * the star ledger — earned stars survive the routine that paid them.
 */
export function DeleteRoutineButton({ routineId, title }: { routineId: string; title: string }) {
  const t = useTranslations('routines');
  const [state, formAction, pending] = useActionState(deleteRoutineAction, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="routineId" value={routineId} />
      {/* Short visible label, full accessible name: a roster of routines
          would otherwise be a column of long, near-identical buttons. */}
      <ConfirmButton
        triggerLabel={t('actions.removeNamed', { title })}
        question={t('actions.removeConfirm')}
        confirmLabel={t('actions.removeConfirmYes')}
        pending={pending}
        testId="delete-routine"
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
