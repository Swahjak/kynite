import { getTranslations } from 'next-intl/server';
import { PageHeader, SectionHeading } from '@/components/kynite';
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
      <PageHeader
        icon="star"
        iconTint="gold"
        iconFilled
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <>
            {data.canAward && data.children.length > 0 ? (
              <AwardStarsDialog members={data.children} />
            ) : null}
            {data.canManage ? <RewardDialog members={data.children} /> : null}
          </>
        }
      />

      <ApprovalQueue
        pending={data.pending}
        outstanding={data.outstanding}
        history={data.history}
        memberNames={memberNames}
        canApprove={data.canApprove}
      />

      <section className="flex flex-col gap-4">
        <SectionHeading
          icon="redeem"
          iconTint="brand-container"
          iconFilled
          title={t('catalogueTitle')}
        />
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
