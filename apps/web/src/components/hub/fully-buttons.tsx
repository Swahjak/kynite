'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Icon } from '@kynite/ui';

/** The Fully Kiosk Browser JavaScript Interface surface both buttons in this
 * file rely on (https://www.fully-kiosk.com/en/#javascript). Only the two
 * members either button touches — `startApplication` is optional because
 * older Fully builds shipped `fully://launcher` (see `FullyLauncherButton`)
 * before that method existed. */
interface FullyInterface {
  startApplication?: (packageName: string) => void;
}

const noopSubscribe = () => () => {};

/** `window.fully` never changes shape after load, so there is nothing to
 * subscribe to — this exists only to give `useSyncExternalStore` the "assume
 * absent until the client checks" server snapshot without a
 * setState-in-an-effect render. */
function getFully(): FullyInterface | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { fully?: FullyInterface }).fully;
}

function isInFully(): boolean {
  return typeof getFully() !== 'undefined';
}

/** Shared gating: both buttons below render only inside Fully — `window.fully`
 * exists solely when the page runs in Fully's WebView with its JavaScript
 * Interface enabled. Everywhere else — a normal browser, `pnpm dev`,
 * Playwright — that global is absent, so neither button must appear.
 * Detected with `useSyncExternalStore` rather than a plain render-time check
 * so the server-rendered markup (which cannot know) and the first client
 * paint agree — hidden by default, shown only once the check has actually
 * run. */
function useInFully(): boolean {
  return useSyncExternalStore(noopSubscribe, isInFully, () => false);
}

/**
 * Opens Fully Kiosk Browser's Universal Launcher — the whitelisted-apps
 * picker (e.g. Google Home) Fully itself draws behind the special
 * `fully://launcher` URL.
 */
export function FullyLauncherButton() {
  const t = useTranslations('devices.hubSettings');
  const inFully = useInFully();

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

/** The Google Home app's Android package name — the target of
 * `fully.startApplication`. */
const GOOGLE_HOME_PACKAGE = 'com.google.android.apps.chromecast.app';

/**
 * Starts the Google Home app directly, via Fully's JavaScript Interface
 * rather than the Universal Launcher picker `FullyLauncherButton` opens — a
 * family standing at the wall wants Google Home itself, not a menu to find it
 * in.
 *
 * `startApplication` is missing on older Fully builds; when it is, the
 * button hides rather than rendering a control that would silently do
 * nothing when tapped.
 */
export function GoogleHomeButton() {
  const t = useTranslations('devices.hubSettings');
  const inFully = useInFully();

  if (!inFully) return null;

  const fully = getFully();
  if (!fully?.startApplication) return null;

  return (
    <Button
      onClick={() => fully.startApplication?.(GOOGLE_HOME_PACKAGE)}
      variant="ghost"
      size="icon-hub"
      aria-label={t('googleHome')}
      title={t('googleHome')}
      data-testid="hub-google-home"
    >
      <Icon name="home" size="lg" />
    </Button>
  );
}
