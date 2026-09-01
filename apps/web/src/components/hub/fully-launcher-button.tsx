'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';

const noopSubscribe = () => () => {};

/** `window.fully` never changes shape after load, so there is nothing to
 * subscribe to — this exists only to give `useSyncExternalStore` the "assume
 * absent until the client checks" server snapshot without a
 * setState-in-an-effect render. */
function isInFully(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { fully?: unknown }).fully !== 'undefined'
  );
}

/**
 * Opens Fully Kiosk Browser's Universal Launcher — the whitelisted-apps
 * picker (e.g. Google Home) Fully itself draws behind the special
 * `fully://launcher` URL.
 *
 * Rendered only inside Fully: `window.fully` exists solely when the page runs
 * in Fully's WebView with its JavaScript Interface enabled
 * (https://www.fully-kiosk.com/en/#javascript). Everywhere else — a normal
 * browser, `pnpm dev`, Playwright — that global is absent, so a link nobody
 * can follow (`fully://launcher` is not a scheme any other browser resolves)
 * must not appear. Detected with `useSyncExternalStore` rather than a plain
 * render-time check so the server-rendered markup (which cannot know) and the
 * first client paint agree — hidden by default, shown only once the check has
 * actually run.
 */
export function FullyLauncherButton() {
  const t = useTranslations('devices.hubSettings');
  const inFully = useSyncExternalStore(noopSubscribe, isInFully, () => false);

  if (!inFully) return null;

  return (
    <Button
      render={<a href="fully://launcher" title={t('launcher.open')} />}
      nativeButton={false}
      variant="ghost"
      size="icon-hub"
      aria-label={t('launcher.open')}
      data-testid="hub-launcher"
    >
      <Icon name="apps" size="lg" />
    </Button>
  );
}
