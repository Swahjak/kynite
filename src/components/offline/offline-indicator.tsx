'use client';

import { useTranslations } from 'next-intl';
import { useRealtimeStatus, type RealtimeStatus } from '@/components/realtime';

/**
 * "Working from the last known plan" (PRD FR21; docs/architecture.md §6).
 *
 * **Derived from the SSE connection, never from `navigator.onLine`.** §6 gives
 * the reason in one line: "a captive-portal tablet lies about `onLine`". A
 * wall display on a hotel-style guest network, or one whose router is up but
 * whose uplink is down, reports itself perfectly online while nothing it shows
 * is current. The stream is the only thing on the device that has actually
 * talked to the server, so the stream is what the indicator reads.
 *
 * The tone is the other half of the requirement. FR21 asks for a
 * *non-disruptive* indicator, and the psychology law (research §"Nagging")
 * applies to system messages too: this is a small neutral pill stating a fact
 * about the connection. It never covers the board, never turns red, never
 * apologises, and never tells anyone to do anything about it.
 */

/** `connecting` is not offline: a reconnect in progress is still the normal state. */
export function isOfflineStatus(status: RealtimeStatus): boolean {
  return status === 'offline';
}

export function OfflineIndicator() {
  const status = useRealtimeStatus();
  const t = useTranslations('offline');

  if (!isOfflineStatus(status)) return null;

  return (
    <p
      data-testid="offline-indicator"
      data-status={status}
      // `polite`, not `alert`: it is information, not an interruption.
      role="status"
      aria-live="polite"
      // A plain string rather than `cn()`, and deliberately: `twMerge` reads
      // both `text-body-sm` (a design-system size token) and
      // `text-ink-secondary` as `text-*` colour utilities and drops one of
      // them. Every other component in this repo that pairs a body token with
      // an ink token does the same thing for the same reason.
      className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-body-sm text-ink-secondary"
    >
      <span aria-hidden className="size-2 rounded-full bg-ink-secondary/60" />
      {t('lastKnown')}
    </p>
  );
}
