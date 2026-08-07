import 'server-only';
import { getPrincipal } from '@/modules/family';
import { missingPushConfig, pushPublicKey } from './config';
import { countActiveSubscriptions } from './queries';

/**
 * What the notification settings surface needs (M11; the full settings tree is
 * M16's).
 *
 * The VAPID *public* key is read here, at request time, and handed to the
 * client component as a prop. It is public by definition — it is the
 * application server key every push subscription embeds — but it is read from
 * the server environment rather than inlined as `NEXT_PUBLIC_`, so a build
 * with no secrets still produces a working bundle (`src/server/env.ts`).
 */

export type NotificationsPageData = {
  publicKey: string | null;
  missingConfig: string[];
  subscriptionCount: number;
};

/** Null when there is no member principal — the caller renders a notice. */
export async function loadNotificationsPage(): Promise<NotificationsPageData | null> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return null;

  return {
    publicKey: pushPublicKey(),
    missingConfig: missingPushConfig(),
    subscriptionCount: await countActiveSubscriptions(principal.familyId, principal.memberId),
  };
}
