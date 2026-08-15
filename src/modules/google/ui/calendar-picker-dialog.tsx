'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSubmitGuard } from '@/components/ui/use-submit-guard';
import { idleState, type ActionState } from '../action-state';
import { applyCalendarSelectionAction } from '../actions';
import type { LinkedAccount } from '../queries';

/**
 * "Which of these should the family see?" — the first thing a parent answers
 * after connecting a Google account.
 *
 * Linking used to decide for them: every calendar Google reported as *selected*
 * arrived switched on, which for a normal account means holiday feeds, a
 * partner's diary and a birthdays calendar all landing on the wall unasked, and
 * for a work account means the entire office. Discovery now switches on the
 * account's own calendar and nothing else, and this dialog is where everything
 * else is chosen — once, in one confirmation, instead of a row of toggles each
 * costing a round trip.
 *
 * Dismissing it is a valid answer. The defaults are already applied server-side
 * by the time the settings page renders, so a parent who closes the dialog is
 * left with a working, primary-only sync rather than nothing.
 *
 * Closing also strips `?linked=` from the URL, so a refresh — or the browser
 * restoring the tab tomorrow — does not re-open a question that has been
 * answered.
 */
export function CalendarPickerDialog({ account }: { account: LinkedAccount }) {
  const t = useTranslations('google');
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(account.calendars.filter((row) => row.syncEnabled).map((row) => row.id))
  );

  const [state, action, pending] = useActionState<ActionState, FormData>(
    applyCalendarSelectionAction,
    idleState
  );
  const { locked, lock } = useSubmitGuard(pending);

  const close = useCallback(() => {
    setOpen(false);
    const params = new URLSearchParams(search.toString());
    params.delete('linked');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, search]);

  // The action returns `idle` on success and `error` on refusal, so "did it
  // finish?" is the falling edge of `pending` — not a value in the state.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state.status !== 'error') close();
    wasPending.current = pending;
  }, [close, pending, state]);

  const toggle = (calendarId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(calendarId)) next.delete(calendarId);
      else next.add(calendarId);
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent size="hub" className="sm:max-w-md" data-testid="calendar-picker">
        <form action={action} onSubmit={lock} className="flex flex-col gap-4">
          <input type="hidden" name="accountId" value={account.id} />
          {/* One field, not one checkbox input per calendar: an unticked
              checkbox submits nothing, which would make "switch this off"
              indistinguishable from "not on the screen". */}
          <input type="hidden" name="calendarIds" value={[...selected].join(',')} />

          <DialogHeader>
            <DialogTitle>{t('picker.title')}</DialogTitle>
            <DialogDescription>
              {t('picker.description', { email: account.email })}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex max-h-[50vh] flex-col overflow-y-auto">
            {account.calendars.map((row) => (
              <li key={row.id} className="border-t border-border first:border-t-0">
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-3">
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                    data-testid="calendar-picker-option"
                    data-calendar-id={row.id}
                  />
                  <span className="flex min-w-0 items-center gap-2 font-display text-body-sm font-semibold text-ink">
                    <span
                      aria-hidden
                      className="size-3 shrink-0 rounded-4xl border border-border"
                      style={row.color ? { backgroundColor: row.color } : undefined}
                    />
                    <span className="truncate">{row.summary}</span>
                    {row.writable ? null : (
                      <span className="label-overline shrink-0 text-ink-muted">
                        {t('readOnly')}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
            {account.calendars.length === 0 ? (
              <li className="py-3 text-body-sm text-ink-secondary">{t('noCalendars')}</li>
            ) : null}
          </ul>

          {state.status === 'error' ? (
            <p role="alert" className="text-body-sm text-destructive">
              {t(`errors.${state.error}` as 'errors.forbidden')}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" size="hub" onClick={close}>
              {t('picker.cancel')}
            </Button>
            <Button
              type="submit"
              size="hub"
              disabled={locked}
              data-testid="calendar-picker-confirm"
            >
              {t('picker.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
