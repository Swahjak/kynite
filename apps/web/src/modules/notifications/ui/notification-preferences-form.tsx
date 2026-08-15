'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useActionToast } from '@/components/ui/use-action-toast';
import { idleState } from '../action-state';
import { updateNotificationPreferencesAction } from '../actions';

/**
 * Which notifications *this* parent wants (M16).
 *
 * Per person, not per household: the three switches below are the three things
 * this product sends (§6, PRD FR22), and two parents routinely disagree about
 * all of them — one wants every "may I spend my stars", the other wants none. `member:self` is
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
  preferences: {
    routineReminders: boolean;
    redemptionRequests: boolean;
    completionUpdates: boolean;
  };
}) {
  const t = useTranslations('settings.notifications');
  const tCommon = useTranslations('common');
  const [state, formAction, pending] = useActionState(
    updateNotificationPreferencesAction,
    idleState
  );
  useActionToast(state, pending, { success: tCommon('saved') });

  return (
    <form
      action={formAction}
      className="-mx-2 flex flex-col gap-1"
      data-testid="notification-preferences-form"
    >
      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-200 ease-brand hover:bg-surface-container">
        <input
          type="checkbox"
          name="routineReminders"
          defaultChecked={preferences.routineReminders}
          className="mt-1 size-5 accent-primary"
          data-testid="pref-routine-reminders"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-body-sm font-semibold text-ink">
            {t('routineReminders')}
          </span>
          <span className="text-caption text-ink-muted">{t('routineRemindersHint')}</span>
        </span>
      </label>

      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-200 ease-brand hover:bg-surface-container">
        <input
          type="checkbox"
          name="redemptionRequests"
          defaultChecked={preferences.redemptionRequests}
          className="mt-1 size-5 accent-primary"
          data-testid="pref-redemption-requests"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-body-sm font-semibold text-ink">
            {t('redemptionRequests')}
          </span>
          <span className="text-caption text-ink-muted">{t('redemptionRequestsHint')}</span>
        </span>
      </label>

      <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors duration-200 ease-brand hover:bg-surface-container">
        <input
          type="checkbox"
          name="completionUpdates"
          defaultChecked={preferences.completionUpdates}
          className="mt-1 size-5 accent-primary"
          data-testid="pref-completion-updates"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-body-sm font-semibold text-ink">
            {t('completionUpdates')}
          </span>
          <span className="text-caption text-ink-muted">{t('completionUpdatesHint')}</span>
        </span>
      </label>

      <div className="flex items-center gap-3 px-2 pt-3">
        <Button type="submit" size="hub" disabled={pending} data-testid="save-notification-prefs">
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
