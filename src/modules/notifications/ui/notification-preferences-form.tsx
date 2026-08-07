'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { idleState } from '../action-state';
import { updateNotificationPreferencesAction } from '../actions';

/**
 * Which notifications *this* parent wants (M16).
 *
 * Per person, not per household: the two switches below are the two things
 * this product sends (§6), and two parents routinely disagree about both — one
 * wants every "may I spend my stars", the other wants none. `member:self` is
 * what makes that answerable individually, and it is why this form carries no
 * member field at all: the action takes the subject from the principal.
 *
 * Plain checkboxes rather than a switch component: they submit natively inside
 * the form the action already reads, and an unchecked box submitting nothing
 * is exactly the "off" the action decodes.
 */
export function NotificationPreferencesForm({
  preferences,
}: {
  preferences: { routineReminders: boolean; redemptionRequests: boolean };
}) {
  const t = useTranslations('settings.notifications');
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferencesAction,
    idleState
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      data-testid="notification-preferences-form"
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="routineReminders"
          defaultChecked={preferences.routineReminders}
          className="mt-1 size-5 accent-primary"
          data-testid="pref-routine-reminders"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-sm font-medium">{t('routineReminders')}</span>
          <span className="text-xs text-muted-foreground">{t('routineRemindersHint')}</span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="redemptionRequests"
          defaultChecked={preferences.redemptionRequests}
          className="mt-1 size-5 accent-primary"
          data-testid="pref-redemption-requests"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-sm font-medium">{t('redemptionRequests')}</span>
          <span className="text-xs text-muted-foreground">{t('redemptionRequestsHint')}</span>
        </span>
      </label>

      <div className="flex items-center gap-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-notification-prefs">
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
