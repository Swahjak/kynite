'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@kynite/ui';
import { idleState } from '../action-state';
import { setRoutineRewardAction } from '../actions';

/**
 * "This one runs on its own now" — the fade path's parent-side control
 * (research §Decisions 7, FR17).
 *
 * The button is the *ordinary* variant, not a destructive one, because that is
 * what the action is: a routine graduating is the system working, not something
 * being taken away. The reverse ("start awarding again") sits in the same place
 * and is equally unremarkable — a parent who fades too early should be able to
 * undo it without it feeling like a correction.
 *
 * Nothing about this touches a star that was already earned. There is no
 * confirmation dialog for that reason: there is nothing here to lose.
 */
export function GraduateRoutineButton({
  routineId,
  title,
  graduated,
}: {
  routineId: string;
  title: string;
  graduated: boolean;
}) {
  const t = useTranslations('routines');
  const [state, formAction, pending] = useActionState(setRoutineRewardAction, idleState);

  return (
    <form action={formAction}>
      <input type="hidden" name="routineId" value={routineId} />
      {/* Posts the *target* state, not a toggle: a double submit lands the same
          value twice rather than flipping back and forth. */}
      <input type="hidden" name="rewardEnabled" value={graduated ? 'true' : 'false'} />
      <Button
        type="submit"
        variant="brand-outline"
        size="hub"
        data-testid={graduated ? 'ungraduate-routine' : 'graduate-routine'}
        aria-label={t(graduated ? 'actions.resumeStarsNamed' : 'actions.graduateNamed', { title })}
        disabled={pending}
      >
        {t(graduated ? 'actions.resumeStars' : 'actions.graduate')}
      </Button>
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
