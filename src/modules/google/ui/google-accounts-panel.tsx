'use client';

import { useActionState, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubmitGuard } from '@/components/ui/use-submit-guard';
import { idleState, type ActionState } from '../action-state';
import {
  removeCalendarAction,
  setCalendarSyncAction,
  syncNowAction,
  unlinkGoogleAccountAction,
} from '../actions';
import type { LinkedAccount, LinkedCalendar } from '../queries';

/**
 * The Google settings surface (M05, extended in M18).
 *
 * It has to do exactly three things: start a real OAuth link, let a parent
 * choose which calendars sync, and make a `reauth_required` account impossible
 * to miss. M18 adds the two facts a parent could previously only guess at —
 * *when* an account was linked and what it may actually read, and *when* its
 * calendars last synced — and puts a confirmation in front of the two actions
 * that take data with them.
 *
 * The confirmations are `AlertDialog`, not the two-tap pattern the device list
 * uses, and the reason is the event count: "unlink" and "remove" each destroy
 * an amount of data the parent cannot see from the button, so the dialog exists
 * to *state the number* before it is agreed to. A second tap in place could not
 * carry that sentence.
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
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 px-4 py-3 text-body-sm text-destructive"
        >
          {t(`errors.${error}` as 'errors.linkFailed')}
        </p>
      ) : null}

      {linkedEmail ? (
        <p role="status" className="rounded-xl bg-brand-container/20 px-4 py-3 text-body-sm">
          {t('linkedNotice', { email: linkedEmail })}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t('link.title')}</CardTitle>
          <CardDescription>{t('link.description')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
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
            <p className="rounded-xl bg-surface-container px-4 py-3 text-body-sm text-ink-secondary">
              {t('notConfigured', { missing: missingConfig.join(', ') })}
            </p>
          )}
        </CardContent>
      </Card>

      {accounts.length === 0 ? (
        <p className="px-1 text-body-sm text-ink-secondary">{t('empty')}</p>
      ) : (
        accounts.map((account) => <AccountCard key={account.id} account={account} />)
      )}

      {accounts.length > 0 ? <SyncNowButton /> : null}
    </div>
  );
}

function AccountCard({ account }: { account: LinkedAccount }) {
  const t = useTranslations('google');
  const format = useFormatter();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    unlinkGoogleAccountAction,
    idleState
  );
  const [confirming, setConfirming] = useState(false);
  const { locked, lock } = useSubmitGuard(pending);

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5" data-testid="google-account-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="font-display text-body font-semibold break-all text-ink">
            {account.email}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {account.status === 'reauth_required' ? (
              <Badge variant="destructive">{t('status.reauthRequired')}</Badge>
            ) : (
              <Badge variant="secondary">{t('status.active')}</Badge>
            )}
            {/* M18: whether the grant actually covers calendars. An account
                linked without the scope looks identical to one that has it,
                right up until nothing ever syncs. */}
            <Badge variant="outline" data-testid="calendar-access-badge">
              {account.hasCalendarAccess ? t('calendarAccess') : t('noCalendarAccess')}
            </Badge>
          </div>
          <span className="text-caption text-ink-muted" data-testid="linked-since">
            {t('linkedSince', {
              date: format.dateTime(account.linkedAt, { dateStyle: 'medium' }),
            })}
          </span>
          <span className="text-caption text-ink-muted" data-testid="account-last-sync">
            {account.lastSyncedAt
              ? t('sync.lastSynced', { when: format.relativeTime(account.lastSyncedAt) })
              : t('sync.never')}
          </span>
        </div>

        <Button
          type="button"
          variant="destructive-soft"
          onClick={() => setConfirming(true)}
          disabled={pending}
          data-testid="unlink-account"
        >
          {t('unlink')}
        </Button>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="hub" data-testid="unlink-confirm">
          <form action={action} onSubmit={lock} className="flex flex-col gap-4">
            <input type="hidden" name="accountId" value={account.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>{t('unlinkConfirm.title')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('unlinkConfirm.body', { email: account.email, count: account.eventCount })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button type="button" variant="ghost" size="hub">
                    {t('unlinkConfirm.cancel')}
                  </Button>
                }
              />
              <Button
                type="submit"
                variant="destructive"
                size="hub"
                disabled={locked}
                data-testid="unlink-confirm-yes"
              >
                {t('unlinkConfirm.confirm')}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {state.status === 'error' ? (
        <p role="alert" className="text-body-sm text-destructive">
          {t(`errors.${state.error}` as 'errors.forbidden')}
        </p>
      ) : null}

      {/* The calendars this account brings with it, as a grouped list inside
          the account's own card — full-bleed, so the divider between two
          calendars reaches the card edge the way the mockups' lists do. */}
      <ul className="-mx-4 flex flex-col sm:-mx-5">
        {account.calendars.map((calendar) => (
          <CalendarRow key={calendar.id} calendar={calendar} />
        ))}
        {account.calendars.length === 0 ? (
          <li className="px-4 py-3 text-body-sm text-ink-secondary sm:px-5">{t('noCalendars')}</li>
        ) : null}
      </ul>
    </Card>
  );
}

function CalendarRow({ calendar }: { calendar: LinkedCalendar }) {
  const t = useTranslations('google');
  const format = useFormatter();

  return (
    <li
      className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5"
      data-testid="google-calendar-row"
      data-calendar-id={calendar.id}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 font-display text-body-sm font-semibold text-ink">
          <span
            aria-hidden
            className="size-3 shrink-0 rounded-4xl border border-border"
            style={calendar.color ? { backgroundColor: calendar.color } : undefined}
          />
          {calendar.summary}
          {calendar.writable ? null : (
            <span className="label-overline text-ink-muted">{t('readOnly')}</span>
          )}
        </span>
        {/* M18: `calendar.syncedAt` has been written since M05 and rendered
            nowhere, which made a silently-stalled calendar indistinguishable
            from a quiet one. */}
        <span className="text-caption text-ink-muted" data-testid="calendar-last-sync">
          {calendar.syncedAt
            ? t('sync.lastSynced', { when: format.relativeTime(calendar.syncedAt) })
            : t('sync.never')}
        </span>
      </span>

      <span className="flex items-center gap-2">
        <CalendarToggle calendarId={calendar.id} enabled={calendar.syncEnabled} />
        <RemoveCalendarButton calendar={calendar} />
      </span>
    </li>
  );
}

function RemoveCalendarButton({ calendar }: { calendar: LinkedCalendar }) {
  const t = useTranslations('google');
  const [state, action, pending] = useActionState<ActionState, FormData>(
    removeCalendarAction,
    idleState
  );
  const [confirming, setConfirming] = useState(false);
  const { locked, lock } = useSubmitGuard(pending);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="destructive-soft"
        onClick={() => setConfirming(true)}
        disabled={pending}
        data-testid="remove-calendar"
      >
        {t('calendar.remove')}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size="hub" data-testid="remove-calendar-confirm">
          <form action={action} onSubmit={lock} className="flex flex-col gap-4">
            <input type="hidden" name="calendarId" value={calendar.id} />
            <AlertDialogHeader>
              <AlertDialogTitle>{t('calendar.removeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('calendar.removeBody', {
                  summary: calendar.summary,
                  count: calendar.eventCount,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose
                render={
                  <Button type="button" variant="ghost" size="hub">
                    {t('calendar.removeCancel')}
                  </Button>
                }
              />
              <Button
                type="submit"
                variant="destructive"
                size="hub"
                disabled={locked}
                data-testid="remove-calendar-confirm-yes"
              >
                {t('calendar.removeConfirm')}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {state.status === 'error' ? (
        <span role="alert" className="text-xs text-destructive">
          {t(`errors.${state.error}` as 'errors.forbidden')}
        </span>
      ) : null}
    </>
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
      <Button type="submit" variant="brand-outline" disabled={pending}>
        {t('syncNow')}
      </Button>
    </form>
  );
}
