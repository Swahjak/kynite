import 'server-only';
import { can, getPrincipal } from '@/modules/family';
import { listSubscriptions, type SubscriptionView } from './queries';

/**
 * The server-side read `(app)/settings/subscriptions` composes (architecture
 * §2 rule 4: route files hold no logic).
 */

export type SubscriptionsPageData = {
  subscriptions: SubscriptionView[];
  /** The server's clock, so "bijgewerkt 2 uur geleden" is not the tablet's guess. */
  serverNow: number;
  canManage: boolean;
};

export async function loadSubscriptionsPage(): Promise<SubscriptionsPageData | null> {
  const principal = await getPrincipal();
  // Member-only surface, refused outright rather than left to the capability
  // alone: the feed URLs are the household's own links, and a wall tablet in
  // the hall is where a stranger stands.
  if (!principal || principal.kind !== 'member') return null;
  if (!can(principal, 'ics:manage', { familyId: principal.familyId })) return null;

  return {
    subscriptions: await listSubscriptions(principal.familyId),
    serverNow: Date.now(),
    canManage: true,
  };
}
