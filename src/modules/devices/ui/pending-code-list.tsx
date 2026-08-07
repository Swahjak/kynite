'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { cancelPairingCodeAction } from '../actions';
import type { DevicesPageData } from '../page-data';

/**
 * Codes that have been generated but never typed into a screen (M12 review
 * finding 6 — `DevicesPageData.pending` was computed and never rendered).
 *
 * The **digits are never shown here** — only the hash was ever kept past the
 * moment `PairDevicePanel` displayed them, so there is nothing to show. What a
 * parent actually needs when they come back to this page mid-pairing is
 * smaller: which screens are still waiting, when that stops being true, and a
 * way to give up on one without waiting out the TTL — cancelling deletes the
 * row outright rather than leaving a dead entry for the next `maintenance:trim`
 * pass to clear.
 */
export function PendingCodeList({
  pending,
  serverNow,
  canManage,
}: {
  pending: DevicesPageData['pending'];
  serverNow: number;
  canManage: boolean;
}) {
  const t = useTranslations('devices');
  const format = useFormatter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!canManage || pending.length === 0) return null;

  const cancel = (id: string) => {
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await cancelPairingCodeAction({ id });
      if (result.status === 'error') setError(result.error);
      setPendingId(null);
    });
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-h3 font-semibold">{t('pending.title')}</h2>
      <ul className="flex flex-col gap-2" data-testid="pending-code-list">
        {pending.map((entry) => (
          <li
            key={entry.id}
            data-testid="pending-code-row"
            data-pairing-code-id={entry.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-body font-semibold">{entry.deviceName}</span>
              <span className="text-body-sm text-muted-foreground">
                {t('pending.expires', {
                  when: format.relativeTime(new Date(entry.expiresAt), serverNow),
                })}
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => cancel(entry.id)}
              disabled={pendingId === entry.id}
              data-testid="cancel-pairing-code"
            >
              <Icon name="delete" size="md" inline="start" />
              {t('pending.cancel')}
            </Button>
          </li>
        ))}

        {error ? (
          <li role="alert" className="text-body-sm text-destructive">
            {t(`errors.${error}`)}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
