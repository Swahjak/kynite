import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreateShareLinkPanel, ShareLinkList, loadSharingPage } from '@/modules/sharing';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/settings/sharing` — the parent side of caregiver links (M13).
 *
 * Two things live here: making a link, and taking one away — both
 * `share:manage`, which the §7 matrix grants to owners and adults and to nobody
 * else. `loadSharingPage` refuses a non-member principal outright rather than
 * relying on that cell alone, for the same reason `loadDevicesPage` does: the
 * list of every open door into a household is not something to render on a
 * screen in the hall, or behind a link that is itself one of those doors.
 *
 * This is also where the usage telemetry surfaces. That placement is the
 * feature, not a detail — a share link is the one credential in this product
 * with no person attached to it, so "opened 4 times, last opened yesterday" is
 * the only evidence a parent has when deciding whether a link still belongs to
 * somebody.
 */
export default async function SharingSettingsPage() {
  const data = await loadSharingPage();
  if (!data) notFound();

  const t = await getTranslations('sharing');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {data.canManage ? (
        <CreateShareLinkPanel members={data.members} calendars={data.calendars} />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-semibold">{t('list.title')}</h2>
        <ShareLinkList links={data.links} serverNow={data.serverNow} canManage={data.canManage} />
      </section>
    </main>
  );
}
