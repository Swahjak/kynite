'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { PAIRING_CODE_LENGTH } from '@/lib/device-session';
import { pairingCodeIdle, type PairingCodeState } from '../action-state';
import { createPairingCodeAction } from '../actions';

/**
 * "Add a screen" — name the device, get six digits, type them into the tablet.
 *
 * The code is shown **once**, in a monospaced, widely tracked line: a parent is
 * reading it off a phone and typing it into a wall tablet three metres away, so
 * the failure mode to design against is a misread digit, not a screenshot. A
 * regenerate button is cheaper than any recovery path, and there is none —
 * only the hash is stored.
 */
export function PairDevicePanel() {
  const t = useTranslations('devices');
  const formatDateTime = useDateTimeFormat();
  const [state, setState] = useState<PairingCodeState>(pairingCodeIdle);
  const [deviceName, setDeviceName] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      setState(await createPairingCodeAction({ deviceName, kind: 'hub' }));
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold text-ink">{t('pair.title')}</h2>
        <p className="text-body-sm text-ink-secondary">{t('pair.description')}</p>
      </div>

      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label className="flex min-w-56 flex-1 flex-col gap-1">
          <span className="text-body-sm font-medium">{t('pair.nameLabel')}</span>
          <Input
            name="deviceName"
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            placeholder={t('pair.namePlaceholder')}
            maxLength={60}
            required
            data-testid="device-name-input"
          />
        </label>
        <Button type="submit" disabled={pending || deviceName.trim().length === 0}>
          <Icon name="add" size="md" inline="start" />
          {t('pair.generate')}
        </Button>
      </form>

      {state.status === 'created' ? (
        <output
          className="flex flex-col gap-2 rounded-xl bg-surface-container p-4"
          data-testid="pairing-code-panel"
        >
          <span className="label-overline text-ink-muted">
            {t('pair.codeFor', { name: state.deviceName })}
          </span>
          <span
            className="font-display text-display-md text-ink tracking-[0.2em] tabular-time"
            data-testid="pairing-code"
          >
            {state.code}
          </span>
          <span className="text-body-sm text-ink-secondary" data-testid="pairing-code-hint">
            {t('pair.enterAt', {
              url: `${typeof window === 'undefined' ? '' : window.location.host}/hub`,
            })}
          </span>
          <span className="text-body-sm text-ink-secondary">
            {t('pair.expiresAt', {
              time: formatDateTime(new Date(state.expiresAt), {
                hour: '2-digit',
                minute: '2-digit',
              }),
              digits: PAIRING_CODE_LENGTH,
            })}
          </span>
        </output>
      ) : null}

      {state.status === 'error' ? (
        <p role="alert" className="text-body-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </section>
  );
}
