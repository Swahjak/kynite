'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { idleState, type ActionState } from '../action-state';
import { setCalendarSyncAction, syncNowAction, unlinkGoogleAccountAction } from '../actions';
import type { LinkedAccount } from '../queries';

/**
 * The Google settings surface (milestone M05, minimal by design — the full
 * settings experience is M16). It has to do exactly three things: start a real
 * OAuth link, let a parent choose which calendars sync, and make a
 * `reauth_required` account impossible to miss.
 */

export type GoogleAccountsPanelProps = {
  accounts: LinkedAccount[];
  /** Env vars that are missing; non-empty means linking is switched off. */
  missingConfig: string[];
  /** `?error=` from the OAuth routes, already a translation key. */
  error?: string;
  linkedEmail?: string;
};

export function GoogleAccountsPanel({
  accounts,
  missingConfig,
  error,
  linkedEmail,
}: GoogleAccountsPanelProps) {
  const t = useTranslations('google');
  const configured = missingConfig.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t(`errors.${error}` as 'errors.linkFailed')}
        </p>
      ) : null}

      {linkedEmail ? (
        <p role="status" className="rounded-lg bg-primary/10 px-4 py-3 text-sm">
          {t('linkedNotice', { email: linkedEmail })}
        </p>
      ) : null}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-semibold">{t('link.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('link.description')}</p>
        </div>

        {configured ? (
          // A real anchor, not `next/link`: the target is a route handler whose
          // response is a cross-origin redirect to Google's consent screen, so
          // client-side navigation would be wrong (and `no-html-link-for-pages`
          // is checking for *page* routes, which this is not).
          <Button
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            render={<a href="/api/google/oauth/start" />}
            // Renders as an `<a>`, not a native `<button>` — without this,
            // Base UI's `Button` warns about the native-button
            // keyboard/disabled assumptions it makes by default (F7).
            nativeButton={false}
            size="hub"
            className="self-start"
          >
            {t('link.action')}
          </Button>
        ) : (
          <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t('notConfigured', { missing: missingConfig.join(', ') })}
          </p>
        )}
      </Card>

      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        accounts.map((account) => <AccountCard key={account.id} account={account} />)
      )}

      {accounts.length > 0 ? <SyncNowButton /> : null}
    </div>
  );
}

function AccountCard({ account }: { account: LinkedAccount }) {
  const t = useTranslations('google');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    unlinkGoogleAccountAction,
    idleState
  );

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-medium">{account.email}</span>
          {account.status === 'reauth_required' ? (
            <Badge variant="destructive">{t('status.reauthRequired')}</Badge>
          ) : (
            <Badge variant="secondary">{t('status.active')}</Badge>
          )}
        </div>

        <form action={action}>
          <input type="hidden" name="accountId" value={account.id} />
          <Button type="submit" variant="ghost" disabled={pending}>
            {t('unlink')}
          </Button>
        </form>
      </div>

      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}` as 'errors.forbidden')}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {account.calendars.map((calendar) => (
          <li key={calendar.id} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-3 rounded-full border border-border"
                style={calendar.color ? { backgroundColor: calendar.color } : undefined}
              />
              {calendar.summary}
              {calendar.writable ? null : (
                <span className="text-xs text-muted-foreground">{t('readOnly')}</span>
              )}
            </span>
            <CalendarToggle calendarId={calendar.id} enabled={calendar.syncEnabled} />
          </li>
        ))}
        {account.calendars.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t('noCalendars')}</li>
        ) : null}
      </ul>
    </Card>
  );
}

function CalendarToggle({ calendarId, enabled }: { calendarId: string; enabled: boolean }) {
  const t = useTranslations('google');
  const [, action, pending] = useActionState<ActionState, FormData>(
    setCalendarSyncAction,
    idleState
  );

  return (
    <form action={action}>
      <input type="hidden" name="calendarId" value={calendarId} />
      <input type="hidden" name="enabled" value={enabled ? 'false' : 'true'} />
      <Button
        type="submit"
        size="sm"
        variant={enabled ? 'secondary' : 'outline'}
        disabled={pending}
      >
        {enabled ? t('calendar.disable') : t('calendar.enable')}
      </Button>
    </form>
  );
}

function SyncNowButton() {
  const t = useTranslations('google');
  const [, action, pending] = useActionState<ActionState, FormData>(syncNowAction, idleState);

  return (
    <form action={action}>
      <Button type="submit" variant="outline" disabled={pending}>
        {t('syncNow')}
      </Button>
    </form>
  );
}
