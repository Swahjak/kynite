'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { idleState } from '../action-state';
import { setHubDisplayAction } from '../actions';
import { HUB_VIEWS, type HubView } from '../schema';

/**
 * The hub's default board (PRD FR28, M16).
 *
 * One control, and the copy under it is doing real work: a parent changing
 * this needs to know it applies to every wall display in the house and takes
 * effect there without anyone going and touching the tablet — which is the
 * behaviour `SettingsWatcher` implements and the criterion this closes.
 */
export function HubDisplayForm({ defaultView }: { defaultView: HubView }) {
  const t = useTranslations('settings.hub');
  const [state, formAction, pending] = useActionState(setHubDisplayAction, idleState);

  return (
    <form action={formAction} className="flex flex-col gap-4" data-testid="hub-display-form">
      <Field>
        <FieldLabel>{t('defaultView')}</FieldLabel>
        <Select name="hubDefaultView" defaultValue={defaultView}>
          <SelectTrigger size="hub" data-testid="hub-default-view">
            {/* See `calendar-display-list.tsx`: Base UI shows the raw value
                unless the label is formatted here. */}
            <SelectValue>
              {(value: HubView) => t(`views.${value === 'agenda' ? 'agenda' : 'day'}`)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HUB_VIEWS.map((view) => (
              <SelectItem key={view} value={view}>
                {t(`views.${view}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>{t('defaultViewHint')}</FieldDescription>
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-hub-display">
          {t('save')}
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
