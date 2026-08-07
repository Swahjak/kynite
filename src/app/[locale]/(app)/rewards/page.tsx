import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import {
  ApprovalQueue,
  AwardStarsDialog,
  RewardDialog,
  RewardList,
  loadRewardsPage,
} from '@/modules/rewards';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The parent's reward surface (FR16): the catalogue and the approval queue on
 * one screen, because they are one job — "what can be asked for" and "what has
 * been asked for" are answered in the same sitting.
 *
 * Route files hold no logic (docs/architecture.md §2 rule 4): everything is
 * `loadRewardsPage` plus the slice's own components.
 *
 * Note what this page does *not* render: a table of every child's star totals.
 * `loadRewardsPage` returns them (a parent may legitimately look one up) but
 * nothing here puts two of them side by side, and no child-facing surface can
 * reach them at all — research §Decisions 3, asserted across every reward
 * surface by `e2e/tests/rewards/one-child-at-a-time.spec.ts`.
 */
export default async function RewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const data = await loadRewardsPage();
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('rewards');
  // A plain object, not a lookup function: `ApprovalQueue` is a client
  // component, and React cannot serialise a function across that boundary.
  const memberNames = Object.fromEntries(
    data.members.map((member) => [member.id, member.displayName])
  );

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6"
      data-testid="rewards-page"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gold/20 text-gold-ink shadow-sm"
          >
            <Icon name="star" size="xl" filled />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-h1 font-bold">{t('title')}</h1>
            <p className="text-body-lg text-ink-secondary">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canAward && data.children.length > 0 ? (
            <AwardStarsDialog members={data.children} />
          ) : null}
          {data.canManage ? <RewardDialog members={data.children} /> : null}
        </div>
      </header>

      <ApprovalQueue
        pending={data.pending}
        outstanding={data.outstanding}
        history={data.history}
        memberNames={memberNames}
        canApprove={data.canApprove}
      />

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 font-display text-h2 font-bold">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-container text-brand-container-ink"
          >
            <Icon name="redeem" size="md" filled />
          </span>
          {t('catalogueTitle')}
        </h2>
        <RewardList
          rewards={data.rewards}
          members={data.members}
          assignableMembers={data.children}
          presets={data.presets}
          canWrite={data.canManage}
        />
      </section>
    </main>
  );
}
