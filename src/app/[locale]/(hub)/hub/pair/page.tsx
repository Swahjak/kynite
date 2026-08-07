import { getTranslations } from 'next-intl/server';
import { PairCodeForm } from '@/modules/devices';
import { getPrincipal } from '@/modules/family';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `/hub/pair` — the kiosk half of device pairing (docs/architecture.md §7).
 *
 * The one hub surface that runs *without* a device principal, which is why it
 * is the only page in this tree that does not call `requireHubDevice`. It has
 * the inverse gate instead: an already-paired tablet that somehow lands here is
 * sent straight back to the board, so a stray bookmark or a service-worker
 * cached URL cannot strand a working wall display on a keypad.
 *
 * Copy note — this file is inside a child-facing tree, and a child will stand
 * in front of it. Nothing here blames anyone for a code that does not work; the
 * code is what did or did not work. The instructions name where the digits come
 * from (a parent's phone) rather than telling anybody to go and fetch them.
 */
export default async function HubPairPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (principal?.kind === 'device') redirect({ href: '/hub', locale });

  const t = await getTranslations('devices.hubPair');

  return (
    <main
      className="flex min-h-full flex-col items-center justify-center gap-10 p-8 text-center"
      data-testid="hub-pair"
    >
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="font-display text-display-md font-extrabold">{t('title')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('instructions')}</p>
      </div>

      <PairCodeForm />
    </main>
  );
}
