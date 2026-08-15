'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@kynite/ui';

/**
 * The only place in the codebase that calls `Notification.requestPermission()`
 * (docs/architecture.md §6 step 1: "Opt-in prompted after a meaningful action,
 * never on first load"; M11 asserts it with a cold-entry Playwright test).
 *
 * That constraint is not politeness — a browser that gets a permission prompt
 * from a page the user has not chosen to engage with will refuse to ask again,
 * and a household that dismissed it once can never be reminded of anything.
 * So the prompt is behind a button, on a settings page a parent navigated to,
 * and it can only be reached by a deliberate tap.
 *
 * The copy is neutral throughout (research §"Nagging"): notifications are
 * described as what the household will be *told*, never as something the
 * parent is failing to keep up with.
 */

export const PUSH_SUBSCRIBE_ENDPOINT = '/api/push/subscribe';

type State = 'unsupported' | 'unconfigured' | 'off' | 'on' | 'denied' | 'working';

/** base64url → the `Uint8Array` `applicationServerKey` wants. */
export function decodeVapidKey(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  // Backed by a plain `ArrayBuffer` so the type matches `BufferSource`
  // exactly — `Uint8Array<ArrayBufferLike>` is not assignable to it.
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type PushOptInProps = {
  /**
   * The VAPID application server key, read from the environment at request
   * time by the page and passed down — deliberately not a `NEXT_PUBLIC_`
   * variable, so `next build` needs no secrets (see `src/server/env.ts`).
   * `null` means push is not configured on this install.
   */
  publicKey: string | null;
  /** Live endpoints already registered for this member. */
  subscriptionCount: number;
};

/**
 * What this browser can do, resolved once. Async throughout — deliberately:
 * the effect below must not call `setState` synchronously (React would be
 * rendering twice for a value it could have had), and every branch here is a
 * *read* of browser state. `Notification.permission` never prompts; only
 * `requestPermission()` does, and it is not called from this path.
 */
async function detectState(publicKey: string | null): Promise<State> {
  if (!publicKey) return 'unconfigured';
  if (typeof window === 'undefined') return 'off';
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export function PushOptIn({ publicKey, subscriptionCount }: PushOptInProps) {
  const t = useTranslations('notifications.settings');
  const [state, setState] = useState<State>(publicKey ? 'off' : 'unconfigured');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void detectState(publicKey).then((detected) => {
      if (!cancelled) setState(detected);
    });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setError(null);
    setState('working');

    try {
      // The prompt. Reached only from this click handler.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push may only wake the device if it
        // shows the user something.
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(publicKey),
      });

      const response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!response.ok) throw new Error('subscribe failed');
      setState('on');
    } catch {
      setError(t('error'));
      setState('off');
    }
  }, [publicKey, t]);

  const disable = useCallback(async () => {
    setError(null);
    setState('working');

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
          method: 'DELETE',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('off');
    } catch {
      setError(t('error'));
      setState('on');
    }
  }, [t]);

  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5" data-testid="push-opt-in">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-h3 font-semibold text-ink">{t('title')}</h2>
        <p className="text-body-sm text-ink-secondary">{t('description')}</p>
      </div>

      {state === 'unconfigured' ? (
        <p className="text-body-sm text-ink-secondary">{t('unconfigured')}</p>
      ) : state === 'unsupported' ? (
        <p className="text-body-sm text-ink-secondary">{t('unsupported')}</p>
      ) : state === 'denied' ? (
        <p className="text-body-sm text-ink-secondary">{t('denied')}</p>
      ) : (
        <div className="flex items-center gap-3">
          {state === 'on' ? (
            <Button type="button" variant="outline" onClick={() => void disable()}>
              {t('disable')}
            </Button>
          ) : (
            <Button type="button" disabled={state === 'working'} onClick={() => void enable()}>
              {t('enable')}
            </Button>
          )}
          <span className="text-body-sm text-ink-secondary">
            {t('deviceCount', { count: subscriptionCount })}
          </span>
        </div>
      )}

      {error ? (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
