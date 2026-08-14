'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { renameDeviceAction, revokeDeviceAction } from '../actions';
import type { DevicesPageData } from '../page-data';

/**
 * The paired-device list, with revocation.
 *
 * The name is editable in place (M18): a tablet named "Tablet" at pairing time
 * could previously only be revoked and re-paired to become "Keuken", which is
 * an absurd price for a typo. Inline rather than in a dialog, because the field
 * is one line and the row it belongs to is the context — a modal would hide the
 * "last seen" line that is the only way to tell two tablets apart while typing.
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
  const formatDateTime = useDateTimeFormat();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // The device whose name is currently being edited, and the draft value.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  // The device pending a *second* tap before it is actually revoked (review
  // finding 7 — the same two-tap shape `HubSettings`'s self-unpair uses, for
  // the same reason: revoking is destructive to whatever screen it targets,
  // and a single stray tap must not be enough to do it).
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (devices.length === 0) {
    return (
      <p className="text-body-sm text-ink-secondary" data-testid="devices-empty">
        {t('list.empty')}
      </p>
    );
  }

  const rename = (deviceId: string) => {
    const name = draftName.trim();
    if (name.length === 0) return;

    setRenamingId(null);
    setPendingId(deviceId);
    setError(null);
    startTransition(async () => {
      const result = await renameDeviceAction({ deviceId, name });
      if (result.status === 'error') setError(result.error);
      setPendingId(null);
    });
  };

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
          className="flex min-h-12 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors duration-200 ease-brand data-[revoked=true]:bg-surface-container data-[revoked=true]:opacity-60 data-[revoked=true]:shadow-none"
        >
          <div className="flex min-w-0 flex-col gap-0.5">
            {renamingId === entry.id ? (
              <div className="flex flex-wrap items-center gap-2" data-testid="rename-device-form">
                <Input
                  aria-label={t('list.renameLabel')}
                  value={draftName}
                  maxLength={60}
                  autoFocus
                  onChange={(changeEvent) => setDraftName(changeEvent.currentTarget.value)}
                  onKeyDown={(keyEvent) => {
                    if (keyEvent.key === 'Enter') rename(entry.id);
                    if (keyEvent.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-48"
                  data-testid="rename-device-input"
                />
                <Button
                  type="button"
                  onClick={() => rename(entry.id)}
                  disabled={pendingId === entry.id || draftName.trim().length === 0}
                  data-testid="rename-device-save"
                >
                  {t('list.renameSave')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRenamingId(null)}
                  data-testid="rename-device-cancel"
                >
                  {t('list.renameCancel')}
                </Button>
              </div>
            ) : (
              <span
                className="font-display text-body font-semibold text-ink"
                data-testid="device-name"
              >
                {entry.name}
              </span>
            )}
            <span className="text-body-sm text-ink-secondary">
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
            {/* M18: `pairedAt` has been loaded since M12 and rendered nowhere.
                It is the second half of "which of these two tablets is which" —
                "last seen" answers it for a live screen, "paired on" answers it
                for one that has been quiet for a week. */}
            <span className="text-caption text-ink-muted" data-testid="device-paired-at">
              {t('list.pairedAt', {
                date: formatDateTime(new Date(entry.pairedAt), { dateStyle: 'medium' }),
              })}
            </span>
          </div>

          {canManage && entry.revokedAt === null ? (
            confirmingId === entry.id ? (
              <div className="flex items-center gap-2" data-testid="revoke-device-confirm">
                <span className="text-body-sm text-ink-secondary">{t('list.revokeConfirm')}</span>
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraftName(entry.name);
                    setRenamingId(entry.id);
                  }}
                  disabled={pendingId === entry.id}
                  data-testid="rename-device"
                >
                  {t('list.rename')}
                </Button>
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
              </div>
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
