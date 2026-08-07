'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { revokeDeviceAction } from '../actions';
import type { DevicesPageData } from '../page-data';

/**
 * The paired-device list, with revocation.
 *
 * "Last seen" is deliberately the loudest column after the name: it is the only
 * way a parent can tell which of two tablets called "Kitchen" is the one still
 * on the wall, and therefore the only way revocation is a decision rather than
 * a coin flip. A revoked device stays in the list, greyed, rather than
 * vanishing — a row that disappears leaves the parent unsure whether the tap
 * worked.
 */
export function DeviceList({
  devices,
  serverNow,
  canManage,
}: {
  devices: DevicesPageData['devices'];
  serverNow: number;
  canManage: boolean;
}) {
  const t = useTranslations('devices');
  const format = useFormatter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // The device pending a *second* tap before it is actually revoked (review
  // finding 7 — the same two-tap shape `HubSettings`'s self-unpair uses, for
  // the same reason: revoking is destructive to whatever screen it targets,
  // and a single stray tap must not be enough to do it).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (devices.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground" data-testid="devices-empty">
        {t('list.empty')}
      </p>
    );
  }

  const revoke = (deviceId: string) => {
    setConfirmingId(null);
    setPendingId(deviceId);
    setError(null);
    startTransition(async () => {
      const result = await revokeDeviceAction({ deviceId });
      if (result.status === 'error') setError(result.error);
      setPendingId(null);
    });
  };

  return (
    <ul className="flex flex-col gap-2" data-testid="device-list">
      {devices.map((entry) => (
        <li
          key={entry.id}
          data-testid="device-row"
          data-device-id={entry.id}
          data-revoked={entry.revokedAt !== null}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 data-[revoked=true]:opacity-60"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-body font-semibold">{entry.name}</span>
            <span className="text-body-sm text-muted-foreground">
              {entry.revokedAt !== null
                ? t('list.revoked', {
                    when: format.relativeTime(new Date(entry.revokedAt), serverNow),
                  })
                : entry.lastSeenAt === null
                  ? t('list.neverSeen')
                  : t('list.lastSeen', {
                      when: format.relativeTime(new Date(entry.lastSeenAt), serverNow),
                    })}
            </span>
          </div>

          {canManage && entry.revokedAt === null ? (
            confirmingId === entry.id ? (
              <div className="flex items-center gap-2" data-testid="revoke-device-confirm">
                <span className="text-body-sm text-muted-foreground">
                  {t('list.revokeConfirm')}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => revoke(entry.id)}
                  disabled={pendingId === entry.id}
                  data-testid="revoke-device-confirm-yes"
                >
                  <Icon name="delete" size="md" inline="start" />
                  {t('list.revokeConfirmYes')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setConfirmingId(null)}
                  data-testid="revoke-device-confirm-cancel"
                >
                  {t('list.revokeConfirmCancel')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmingId(entry.id)}
                disabled={pendingId === entry.id}
                data-testid="revoke-device"
              >
                <Icon name="delete" size="md" inline="start" />
                {t('list.revoke')}
              </Button>
            )
          ) : null}
        </li>
      ))}

      {error ? (
        <li role="alert" className="text-body-sm text-destructive">
          {t(`errors.${error}`)}
        </li>
      ) : null}
    </ul>
  );
}
