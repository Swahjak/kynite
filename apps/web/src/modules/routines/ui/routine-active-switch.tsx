'use client';

import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from '@kynite/ui';
import { idleState } from '../action-state';
import { setRoutineActiveAction } from '../actions';

/**
 * The switch on a routine row (`Routines.dc.html`, mobile beheer).
 *
 * A switch and not a checkbox, deliberately: in this product a tick means
 * "done, with a star" — it is what a child taps on the hub — and reusing that
 * glyph for a parent's setting would make the two mean the same thing on two
 * screens where they mean opposite things. A switch says "on / off", which is
 * what pausing a routine is.
 *
 * It submits its own form on change rather than waiting for a Save button:
 * there is nothing else on this screen to save, and a list of switches with a
 * pending Save is a list a parent leaves half-applied.
 */
export function RoutineActiveSwitch({
  routineId,
  title,
  active,
}: {
  routineId: string;
  title: string;
  active: boolean;
}) {
  const t = useTranslations('routines');
  const [state, formAction, pending] = useActionState(setRoutineActiveAction, idleState);
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={formAction} className="flex shrink-0 items-center">
      <input type="hidden" name="routineId" value={routineId} />
      {/* Posts the *target* state, not a toggle: a double submit lands the same
          value twice rather than flipping back and forth. */}
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <Switch
        checked={active}
        disabled={pending}
        data-testid="routine-active-switch"
        aria-label={t('manage.activeToggle', { title })}
        onCheckedChange={() => form.current?.requestSubmit()}
      />
      {state.status === 'error' ? (
        <span role="alert" className="sr-only">
          {t(`errors.${state.error}`)}
        </span>
      ) : null}
    </form>
  );
}
