'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { idleState } from '../action-state';
import { deleteRoutineAction } from '../actions';

/**
 * Deleting a routine is a *parent* action on the parent surface, so it behaves
 * like every other destructive control in the app. Note what it is not: there
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
