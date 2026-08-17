'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Badge, Button } from '@kynite/ui';
import { revokeShareLinkAction } from '../actions';
import type { SharingPageData } from '../page-data';

/**
 * Every link the family has ever made, with the telemetry the M13 criterion
 * names: `lastUsedAt` and `useCount`, visible to parents.
 *
 * **Usage is the loudest column after the label**, and that is the whole point
 * of the surface. A share link is a house key with no face attached to it: the
 * only thing that turns "I think I sent Oma a link in March" into a decision is
 * seeing that it was opened four times and last opened yesterday. A link that
 * has never been opened is the one that is safe to revoke; a link that is
 * opened daily is somebody's routine.
 *
 * Revoked and expired links stay in the list, muted, rather than vanishing —
 * the same reasoning as the device list. A row that disappears leaves a parent
 * unsure whether the tap worked, and the history is the point.
 *
 * Revocation is two taps. It is destructive to whoever is holding the link, and
 * a stray tap on a phone must not be enough.
 */
export function ShareLinkList({
  links,
  serverNow,
  canManage,
}: {
  links: SharingPageData['links'];
  serverNow: number;
  canManage: boolean;
}) {
  const t = useTranslations('sharing');
  const format = useFormatter();
  const formatDateTime = useDateTimeFormat();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (links.length === 0) {
    return (
      <p className="text-body-sm text-ink-secondary" data-testid="share-links-empty">
        {t('list.empty')}
      </p>
    );
  }

  const revoke = (id: string) => {
    setConfirmingId(null);
    setPendingId(id);
    setError(null);
    startTransition(async () => {
      const result = await revokeShareLinkAction({ id });
      if (result.status === 'error') setError(result.error);
      setPendingId(null);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p role="alert" className="text-body-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li
            key={link.id}
            data-testid="share-link-row"
            data-state={link.state}
            className={
              // The list sits inside `SettingsSection`'s card, so a row is a
              // tonal fill rather than a card of its own.
              link.state === 'active'
                ? 'flex flex-col gap-2 rounded-xl bg-surface-container p-4'
                : 'flex flex-col gap-2 rounded-xl bg-surface-container p-4 opacity-60'
            }
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-display text-body font-semibold text-ink">
                {link.label ?? t('list.untitled')}
              </span>
              <Badge variant="outline">{t(`roles.${link.role}`)}</Badge>
            </div>

            <p className="text-body-sm text-ink-secondary">
              {link.memberNames.length > 0
                ? t('list.scopedTo', { names: link.memberNames.join(', ') })
                : t('list.scopeAll')}
            </p>

            <p className="text-body-sm text-ink-secondary" data-testid="share-link-usage">
              {link.lastUsedAt
                ? t('list.usage', {
                    count: link.useCount,
                    when: format.relativeTime(new Date(link.lastUsedAt), new Date(serverNow)),
                  })
                : t('list.neverUsed')}
            </p>

            <p className="text-caption text-ink-muted" data-testid="share-link-state">
              {link.state === 'revoked' && link.revokedAt
                ? t('list.revokedAt', {
                    when: format.relativeTime(new Date(link.revokedAt), new Date(serverNow)),
                  })
                : link.state === 'expired' && link.expiresAt
                  ? t('list.expiredAt', {
                      when: format.relativeTime(new Date(link.expiresAt), new Date(serverNow)),
                    })
                  : link.expiresAt
                    ? t('list.expiresAt', {
                        date: formatDateTime(new Date(link.expiresAt), {
                          day: 'numeric',
                          month: 'long',
                        }),
                      })
                    : t('list.noExpiry')}
            </p>

            {canManage && link.state !== 'revoked' ? (
              confirmingId === link.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body-sm">{t('list.revokeConfirm')}</span>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={pendingId === link.id}
                    onClick={() => revoke(link.id)}
                    data-testid="share-revoke-confirm"
                  >
                    {t('list.revokeConfirmYes')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setConfirmingId(null)}>
                    {t('list.revokeConfirmCancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  className="self-start"
                  onClick={() => setConfirmingId(link.id)}
                  data-testid="share-revoke"
                >
                  {t('list.revoke')}
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
