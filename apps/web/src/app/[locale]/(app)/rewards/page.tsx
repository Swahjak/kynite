import { getTranslations } from 'next-intl/server';
import {
  ApprovalQueue,
  AwardStarsDialog,
  RewardDialog,
  RewardList,
  RewardsTabs,
  StarBalances,
  loadRewardsPage,
} from '@/modules/rewards';
import { MEMBER_COLOR_CLASSES, initialsOf } from '@/modules/family';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The parent's reward surface (FR16) — `Beloningen.dc.html`, mobile beheer.
 *
 * Three tabs over one economy: what is waiting on a human, what is on the
 * shelf, and where everybody stands. The queue is first and default, because it
 * is the only one of the three where somebody is waiting.
 *
 * Route files hold no logic (docs/architecture.md §2 rule 4): everything is
 * `loadRewardsPage` plus the slice's own components.
 *
 * Note where the balances are: on a tab of a *parent* screen, behind an account
 * session that a hub device can never hold (`(app)/layout.tsx` sends a paired
 * browser to the board). No child-facing surface can reach them at all —
 * research §Decisions 3, asserted across every reward surface by
 * `e2e/tests/rewards/one-child-at-a-time.spec.ts`.
 */
export default async function RewardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const data = await loadRewardsPage();
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('rewards');

  // Faces resolved on this side of the client boundary: `ApprovalQueue` is a
  // client component, and reaching into `@/modules/family` for the colour map
  // from there would pull the family barrel — and `pg` — into the browser.
  const faceOf = (member: (typeof data.members)[number]) => ({
    id: member.id,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    colorClass: MEMBER_COLOR_CLASSES[member.color].surface,
    initials: initialsOf(member.displayName),
  });

  const now = new Date();
  const queueMembers = data.members.map(faceOf);
  const awardMembers = data.children.map(faceOf);

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6"
      data-testid="rewards-page"
    >
      <header className="flex items-center justify-between gap-3">
        {/* "Sterren", not "Beloningen": what a parent comes here to do is
            answer a request and hand out a star, and the catalogue is one tab
            of that rather than the name of the screen. */}
        <h1 className="font-display text-h1 font-extrabold text-ink">{t('manageTitle')}</h1>
        <span className="flex items-center gap-2">
          {data.canAward && data.children.length > 0 ? (
            <AwardStarsDialog members={awardMembers} />
          ) : null}
          {data.canManage ? <RewardDialog members={data.children} compact /> : null}
        </span>
      </header>

      <RewardsTabs
        pendingCount={data.pending.length}
        queue={
          <ApprovalQueue
            pending={data.pending}
            outstanding={data.outstanding}
            members={queueMembers}
            now={now}
            canApprove={data.canApprove}
          />
        }
        catalogue={
          <RewardList
            rewards={data.rewards}
            members={data.members}
            assignableMembers={data.children}
            presets={data.presets}
            canWrite={data.canManage}
          />
        }
        balances={<StarBalances members={data.children} totals={data.totals} />}
      />
    </main>
  );
}
