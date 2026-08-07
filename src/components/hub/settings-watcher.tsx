'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useRealtimeEvents } from '@/components/realtime';

/**
 * Keeps the wall display current with the household's settings (M16, FR28).
 *
 * FR28's acceptance criterion is that hub display preferences "take effect on
 * the hub **without re-pairing**", and the hard half of that word is not
 * pairing — it is that nobody is standing at the wall. Every other hub surface
 * updates because a child taps something or because a row changed and its
 * slice published an event; a settings change publishes nothing about a row
 * the board renders, so the tablet has no reason to re-render and would keep
 * showing the old board until someone walked past and touched it.
 *
 * So `settings.updated` (§4 vocabulary, added in M16) is the trigger, and
 * `router.refresh()` is the whole response: the server is the only thing that
 * knows what the new settings mean — which board to draw, which colours, which
 * language — and re-asking it is cheaper and more honest than teaching the
 * client to apply a patch it would have to keep in sync forever.
 *
 * Scoped to the family channel by the stream itself, so there is no id to
 * compare here: every event that arrives is this household's.
 */
export function SettingsWatcher() {
  const router = useRouter();

  useRealtimeEvents(
    ['settings.updated'],
    useCallback(() => router.refresh(), [router])
  );

  return null;
}
