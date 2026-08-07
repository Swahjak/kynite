'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { idleState } from '../action-state';
import { deleteFamilyAction } from '../actions';

/**
 * Deleting the household (M16) — owner-only, and the last thing on the page.
 *
 * Two gates, and neither is a modal. The control is collapsed until the owner
 * asks for it, and then it asks them to type the household's name: a
 * confirmation you have to *read something* to satisfy is the only kind that
 * survives a muscle-memory tap. There is no undo behind this — every row in
 * the database cascades off `family.id` — so the friction is the feature.
 *
 * The action signs the owner out and redirects; nothing here has to handle
 * success, because there is no page left to return to.
 */
export function DeleteFamilyForm({ familyName }: { familyName: string }) {
  const t = useTranslations('settings.danger');
  const [armed, setArmed] = useState(false);
  const [state, formAction, pending] = useActionState(deleteFamilyAction, idleState);

  if (!armed) {
    return (
      <Button
        type="button"
        variant="outline"
        size="hub"
        onClick={() => setArmed(true)}
        data-testid="delete-family-trigger"
      >
        {t('trigger')}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="delete-family-form">
      <Field>
        <FieldLabel>{t('confirmLabel', { name: familyName })}</FieldLabel>
        <Input
          name="confirmName"
          size="hub"
          required
          autoComplete="off"
          data-testid="delete-family-confirm"
        />
        <FieldDescription>{t('confirmHint')}</FieldDescription>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="destructive"
          size="hub"
          disabled={pending}
          data-testid="delete-family-submit"
        >
          {t('confirm')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="hub"
          onClick={() => setArmed(false)}
          disabled={pending}
        >
          {t('cancel')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
