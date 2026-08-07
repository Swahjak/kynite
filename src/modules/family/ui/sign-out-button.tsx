'use client';

import { useTranslations } from 'next-intl';
import { clearUserCachesWithin } from '@/components/offline';
import { Button } from '@/components/ui/button';
import { signOutAction } from '../actions';

/**
 * Sign out — and take this device's copy of the household with it.
 *
 * `signOutAction` discards the session, but the session is not the only thing
 * on the device that knows about a family: the service worker holds rendered
 * pages keyed by URL alone and IndexedDB holds the mirrored board. Left behind
 * on a shared tablet, the next person to sign in can be shown the previous
 * one's `/today` from cache (see `clear-user-caches.ts` for the full case). So
 * the wipe runs *first*, in the browser where those APIs live, and the action
 * only runs once it has finished.
 *
 * `clearUserCachesWithin` cannot reject and cannot hang — a sign-out that
 * waits on storage is worse than one that leaves a cache behind, because the
 * person is standing there trying to hand the device over.
 *
 * There is no family-switch equivalent to hook: a session carries exactly one
 * `activeFamilyId` and the only way to change it is to sign out and back in.
 * If M12's device pairing adds a switch, it clears the same way.
 */
export function SignOutButton() {
  const t = useTranslations('auth');

  return (
    <form
      action={async () => {
        await clearUserCachesWithin();
        await signOutAction();
      }}
    >
      <Button type="submit" variant="ghost" size="hub">
        {t('signOut')}
      </Button>
    </form>
  );
}
