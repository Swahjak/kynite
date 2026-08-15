import { getTranslations } from 'next-intl/server';
import { Button, EmptyState, Icon, MemberChip, StarCount } from '@kynite/ui';
import { ChildTabs } from '@/components/hub';
import { Link } from '@/i18n/navigation';
import { requireHubDevice } from '@/modules/devices';
import {
  RewardStore,
  SavingsGoalCard,
  StarWeekCard,
  loadStarChart,
  loadStore,
  rewardIconOf,
} from '@/modules/rewards';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The child-facing reward store on the hub (M08, FR16) — `Beloningen.dc.html`.
 *
 * The sheet's two columns: what this child is saving for and how their week
 * went on the left, what they can choose right now on the right.
 *
 * Everything about this page is the child's own shelf, in the board's neutral
 * voice (research §"Nagging / device as messenger"): it names the child, states
 * what they have, and never issues an instruction or speaks for a parent. It
 * shows exactly one child's stars — **the chips are navigation, not
 * comparison**: they carry a face and a name and no number at all, they switch
 * between shelves rather than combining them, and there is no arrangement of
 * this route that renders two (§Decisions 3).
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

  // The week panel beside the shelf. One extra read for the child already
  // resolved above — the sheet puts "how this week went" next to "what you can
  // choose", because the second is what the first is *for*.
  const chart = await loadStarChart({ memberId: store.member.id, date });

  const goalIcon = rewardIconOf(
    store.goal ? (store.tiles.find((tile) => tile.id === store.goal?.rewardId)?.icon ?? null) : null
  );

  return (
    <main
      className="flex min-h-full flex-col gap-5 bg-background px-6 py-4"
      data-testid="hub-store"
      data-member-id={store.member.id}
    >
      <header className="flex flex-wrap items-center gap-4 border-b border-line-subtle pb-4">
        <Button
          variant="ghost"
          size="icon-hub"
          nativeButton={false}
          aria-label={t('store.back')}
          render={<Link href="/hub" />}
        >
          <Icon name="chevron_left" size="lg" />
        </Button>

        <h1 className="font-display text-display-md font-extrabold">{t('store.heading')}</h1>

        {store.chips.length > 1 ? (
          <nav
            data-testid="store-chips"
            aria-label={t('store.chooseMember')}
            className="ml-3 flex flex-wrap gap-2.5"
          >
            {store.chips.map((chip) => {
              const active = chip.id === store.member.id;
              return (
                <MemberChip
                  key={chip.id}
                  size="lg"
                  name={chip.displayName}
                  avatarUrl={chip.avatarUrl}
                  initials={chip.initials}
                  surfaceClass={chip.colorClass}
                  selected={active}
                  data-testid="store-chip"
                  data-member-id={chip.id}
                  data-active={active ? 'true' : 'false'}
                  render={
                    <Link
                      href={{ pathname: '/hub/store', query: { member: chip.id } }}
                      aria-current={active ? 'page' : undefined}
                    />
                  }
                />
              );
            })}
          </nav>
        ) : null}

        <span className="flex-1" />

        {/* The one number this screen is about, and it belongs to exactly one
            child. `available`, not `earned`: this is what the shelf spends. */}
        <StarCount
          data-testid="available-stars"
          data-member-id={store.member.id}
          value={store.totals.available}
          srLabel={t('store.availableStars')}
          size="lg"
          className="h-14 shrink-0 px-6 text-h1"
        />
      </header>

      {/* M19. Two different switches, deliberately: the store's own chips
          change *whose* shelf this is, these change *which screen* of that
          child's you are on. */}
      <ChildTabs memberId={store.member.id} displayName={store.member.displayName} />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.5fr]">
        <div className="flex flex-col gap-5">
          {/* Only the savings tier gets a goal — for a four-year-old a bar
              towards something days away is a bar that does not move — and when
              it is absent the week card simply moves up. */}
          {store.goal ? (
            <SavingsGoalCard
              goal={store.goal}
              icon={goalIcon}
              copy={{
                eyebrow: t('store.currentGoal'),
                remaining: t('store.starsToGo', { count: store.goal.remainingStars }),
                progress: t('store.goalProgress', {
                  have: store.goal.progressStars,
                  need: store.goal.costStars,
                }),
              }}
            />
          ) : null}

          {chart ? <StarWeekCard chart={chart} /> : null}
        </div>

        <RewardStore store={store} />
      </div>
    </main>
  );
}
