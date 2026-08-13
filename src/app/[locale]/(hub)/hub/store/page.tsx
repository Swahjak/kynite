import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/kynite';
import { ChildTabs } from '@/components/hub';
import { requireHubDevice } from '@/modules/devices';
import { RewardStore, loadStore } from '@/modules/rewards';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The child-facing reward store on the hub (M08, FR16).
 *
 * Everything about this page is the child's own shelf, in the board's neutral
 * voice (research §"Nagging / device as messenger"): it names the child, states
 * what they have, and never issues an instruction or speaks for a parent. It
 * shows exactly one child's stars — the chips switch between shelves, they do
 * not combine them, and there is no arrangement of this route that renders two
 * (§Decisions 3).
 *
 * `?member=` picks the shelf and `?date=` pins the derived day so the visual
 * snapshot is deterministic; the latter affects display only (see
 * `page-data.ts` — the Server Action re-derives nothing from it).
 *
 * Addressing is settled in `(hub)/layout.tsx`: the hub tree keeps its `/hub`
 * prefix, and this page is reached only behind a device principal (M12).
 */
export default async function HubStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ member?: string; date?: string }>;
}) {
  const { locale } = await params;
  const { member, date } = await searchParams;
  await requireHubDevice(locale, '/hub/store', { member, date });

  const store = await loadStore({ memberId: member, date });
  const t = await getTranslations('rewards');

  if (!store) {
    return (
      <main className="min-h-full">
        <EmptyState
          size="hub"
          heading
          title={t('store.unavailableTitle')}
          description={t('store.unavailableBody')}
        />
      </main>
    );
  }

  return (
    <main
      className="flex min-h-full flex-col gap-6 bg-background p-6"
      data-testid="hub-store"
      data-member-id={store.member.id}
    >
      <header>
        <h1 className="font-display text-display-md font-extrabold">
          {t('store.title', { name: store.member.displayName })}
        </h1>
        <p className="text-body-lg text-ink-secondary">{t('store.subtitle')}</p>
      </header>

      {/* M19. Two different switches, deliberately: the store's own chips
          change *whose* shelf this is, these change *which screen* of that
          child's you are on. */}
      <ChildTabs memberId={store.member.id} displayName={store.member.displayName} />

      <RewardStore store={store} />
    </main>
  );
}
