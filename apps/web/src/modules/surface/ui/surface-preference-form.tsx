'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Field,
  FieldDescription,
  FieldLabel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kynite/ui';
import { useActionToast } from '@/components/ui/use-action-toast';
import { setSurfacePreferenceAction } from '../actions';
import { idleState } from '../action-state';
import type { SurfacePreference } from '../queries';

const SURFACE_OPTIONS = ['auto', 'app', 'desktop'] as const;

export type SurfacePreferenceFormProps = {
  preference: SurfacePreference;
};

/**
 * "Weergave in deze browser" — lets the member pin this browser to the app or
 * desktop surface, or leave it on `auto` (the resolver's default-from-headers
 * behaviour). The value is stored in a cookie, so it is per-browser by design.
 */
export function SurfacePreferenceForm({ preference }: SurfacePreferenceFormProps) {
  const t = useTranslations('settings.surface');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(setSurfacePreferenceAction, idleState);
  useActionToast(state, pending, { success: tCommon('saved') });

  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="surface-preference-form">
      <Field>
        <FieldLabel>{t('label')}</FieldLabel>
        <Select name="surface" defaultValue={preference}>
          <SelectTrigger data-testid="surface-preference-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SURFACE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`options.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('hint')}</FieldDescription>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending} data-testid="save-surface-preference">
          {t('save')}
        </Button>
        {state.status === 'error' ? (
          <span role="alert" className="text-body-sm text-destructive">
            {t(`errors.${state.error}`)}
          </span>
        ) : null}
      </div>
    </form>
  );
}
