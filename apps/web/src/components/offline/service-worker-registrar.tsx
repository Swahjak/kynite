'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (docs/architecture.md §6, M11).
 *
 * Hand-rolled rather than `@serwist/turbopack/react`'s `SerwistProvider`: the
 * provider also owns *update* behaviour (reload-on-online, waiting-worker
 * prompts), and on a wall tablet that decision belongs to `reload-gate.ts`,
 * which knows whether a child is standing in front of the board. What is left
 * — one `register()` call — is four lines.
 *
 * **No push prompt happens here.** Registering a worker and asking for
 * notification permission are separate acts, and M11's criterion is explicit:
 * push opt-in is never prompted on first load (§6 step 1: "opt-in prompted
 * after a meaningful action"). `Notification.requestPermission()` appears in
 * exactly one place in this codebase, behind a button in settings.
 */

export const SERVICE_WORKER_URL = '/serwist/sw.js';

export function ServiceWorkerRegistrar({
  url = SERVICE_WORKER_URL,
  /** `false` for a frozen visual snapshot or a test that must not install one. */
  enabled = true,
}: {
  url?: string;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    void navigator.serviceWorker
      .register(url, {
        // The worker claims the whole origin; the `Service-Worker-Allowed: /`
        // header from `app/serwist/[path]/route.ts` is what permits it.
        scope: '/',
        // Never let an HTTP cache hide a new worker: a stale `sw.js` is a
        // deploy that silently never reaches the wall.
        updateViaCache: 'none',
      })
      .catch(() => {
        // A failed registration is a degraded PWA, not a broken app — the
        // pages all still render from the network.
      });
  }, [url, enabled]);

  return null;
}
