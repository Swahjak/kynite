'use client';

import { useEffect, useState } from 'react';
import { nextTickDelayMs, serverNowFrom } from '../domain/countdown';

/**
 * The ticking half of "server-authoritative start, local tick".
 *
 * Returns the server's current time, reconstructed from the device clock plus
 * the offset measured by `useTimerChannel`. Two deliberate properties:
 *
 * - It returns `initialServerNow` unchanged on the first render, so the server
 *   HTML and the first client render agree and hydration stays quiet.
 * - It re-arms on the *next whole second of server time*, not every 1000ms, so
 *   the digits change on the second and never skip one after a slow frame.
 */
export function useServerNow(initialServerNow: number, offsetMs: number | null): number {
  const [now, setNow] = useState(initialServerNow);

  useEffect(() => {
    if (offsetMs === null) return;

    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const value = serverNowFrom(Date.now(), offsetMs);
      setNow(value);
      timeout = setTimeout(tick, nextTickDelayMs(value));
    };

    tick();
    return () => clearTimeout(timeout);
  }, [offsetMs]);

  return now;
}
