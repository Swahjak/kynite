import { setRequestLocale } from "next-intl/server";
import {
  RewardStorePage,
  RewardStoreProvider,
} from "@/components/reward-store";
import {
  getRewardsForFamily,
  getPrimaryGoal,
} from "@/server/services/reward-store-service";
import { getBalance, getHistory } from "@/server/services/star-service";
import { getFamilyMemberByUserId } from "@/server/services/family-service";
import { getSession } from "@/lib/get-session";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RewardsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Session and family are guaranteed by (app) layout
  const session = await getSession();
  const familyId = session!.session.familyId!;

  // Get member
  const member = await getFamilyMemberByUserId(session!.user.id, familyId);
  if (!member) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Member not found</p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [rewards, balance, transactions, primaryGoal] = await Promise.all([
    getRewardsForFamily(familyId),
    getBalance(member.id),
    getHistory(member.id, { limit: 10, offset: 0 }),
    getPrimaryGoal(member.id),
  ]);

  // Calculate weekly delta
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyDelta = transactions
    .filter((t) => t.createdAt >= weekAgo)
    .reduce((sum, t) => sum + t.amount, 0);

  // Map rewards to include redemption status
  const rewardsWithStatus = rewards.map((reward) => ({
    ...reward,
    limitType: reward.limitType as
      | "none"
      | "daily"
      | "weekly"
      | "monthly"
      | "once",
    canRedeem: balance >= reward.starCost,
    reason:
      balance >= reward.starCost ? undefined : ("insufficient_stars" as const),
    starsNeeded:
      balance >= reward.starCost ? undefined : reward.starCost - balance,
  }));

  const initialData = {
    rewards: rewardsWithStatus,
    redemptions: [], // Loaded on demand when switching tabs
    balance,
    weeklyDelta,
    recentTransactions: transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      type: t.type as "reward_chart" | "chore" | "bonus" | "redemption",
      description: t.description,
      createdAt: t.createdAt,
    })),
    primaryGoal: primaryGoal
      ? {
          ...primaryGoal,
          limitType: primaryGoal.limitType as
            | "none"
            | "daily"
            | "weekly"
            | "monthly"
            | "once",
        }
      : null,
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <RewardStoreProvider
          familyId={familyId}
          memberId={member.id}
          initialData={initialData}
        >
          <RewardStorePage />
        </RewardStoreProvider>
      </div>
    </div>
  );
}
