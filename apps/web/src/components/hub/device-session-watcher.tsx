'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/components/realtime';

/**
 * Keeps the wall display honest about whether it is still paired (M12).
 *
 * Two triggers, because a kiosk fails in two different ways:
 *
 *  - **the SSE tick.** A parent taps "revoke" on their phone;
 *    `revokeDeviceAction` publishes `device.revoked` on the family channel and
 *    this device — which is still listening, because its stream was opened
 *    before the revocation — sees its own id and leaves. That is the fast
 *    path, and the one families will actually observe: the board in the
 *    kitchen goes to the pair screen while they are still holding the phone.
 *  - **the heartbeat.** Streams die. A tablet that lost its stream at 03:00
 *    and has not navigated since would otherwise keep showing the family's
 *    schedule indefinitely after being revoked. `GET /api/devices/session`
 *    answers `401` once the credential is gone, and doubles as the cookie's
 *    sliding renewal, so the poll is not overhead invented for revocation.
 *
 * Both funnel into `router.refresh()` rather than a hard navigation: the hub
 * pages gate on `requireDevicePrincipal()`, so a refresh with no credential
 * *is* the redirect to the pair screen, and going through the server means the
 * client never has to decide what "not paired" looks like.
 */

/** Hourly: the cookie is a year long, and the SSE path covers the urgent case. */
export const DEVICE_HEARTBEAT_INTERVAL_MS = 60 * 60 * 1000;

export const DEVICE_SESSION_ENDPOINT = '/api/devices/session';

export function DeviceSessionWatcher({ deviceId }: { deviceId: string }) {
  const router = useRouter();

  const check = useCallback(async () => {
    try {
      const response = await fetch(DEVICE_SESSION_ENDPOINT, { cache: 'no-store' });
      if (response.status === 401) router.refresh();
    } catch {
      // Offline. A kiosk with no network is not a kiosk that was revoked, and
      // §6 is explicit that it keeps rendering its last-known board.
    }
  }, [router]);

  useRealtimeEvents(
    ['device.revoked'],
    useCallback(
      (event) => {
        if (event.entity.id !== deviceId) return;
        router.refresh();
      },
      [deviceId, router]
    )
  );

  useEffect(() => {
    const timer = setInterval(() => void check(), DEVICE_HEARTBEAT_INTERVAL_MS);
    // One immediate call on mount: it re-stamps the cookie on every boot, so a
    // tablet that was switched off for months renews the moment it comes back.
    void check();
    return () => clearInterval(timer);
  }, [check]);

  return null;
}
