import { redirect } from "next/navigation";
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
import {
  getFamilyMemberByUserId,
  getFamilyMembers,
} from "@/server/services/family-service";
import { getSession } from "@/lib/get-session";
import { SelectMemberForRewards } from "@/components/reward-store/select-member-for-rewards";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ child?: string }>;
};

export default async function RewardsRoute({ params, searchParams }: Props) {
  const { locale } = await params;
  const { child: selectedChildId } = await searchParams;
  setRequestLocale(locale as Locale);

  // Session and family are guaranteed by (app) layout
  const session = await getSession();
  if (!session?.user || !session.session.familyId) {
    redirect(`/${locale}/login`);
  }
  const familyId = session.session.familyId;

  // Get member
  const member = await getFamilyMemberByUserId(session.user.id, familyId);
  if (!member) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Member not found</p>
      </div>
    );
  }

  const isManager = member.role === "manager";
  // Devices are shared family displays that can view any child's rewards
  const canViewAllMembers = isManager || member.role === "device";

  // Determine which member's rewards to show
  let targetMemberId: string;
  let allChildren:
    | {
        id: string;
        name: string;
        avatarColor: string | null;
        balance: number;
      }[]
    | undefined;

  if (canViewAllMembers) {
    // Managers and devices can view any child's rewards
    const allMembers = await getFamilyMembers(familyId);

    // Find non-manager members (children/participants) - exclude devices
    const children = allMembers.filter(
      (m) => m.role !== "manager" && m.role !== "device"
    );

    if (children.length === 0) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-600">
              No children in family
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add family members to view their rewards.
            </p>
          </div>
        </div>
      );
    }

    // Get balances for all children to show in selector
    const childrenWithBalances = await Promise.all(
      children.map(async (child) => ({
        id: child.id,
        name: child.displayName || child.user?.name || "Child",
        avatarColor: child.avatarColor,
        avatarUrl: child.user?.image,
        balance: await getBalance(child.id),
      }))
    );

    allChildren = childrenWithBalances;

    // No child selected - show member selection UI
    if (!selectedChildId) {
      return <SelectMemberForRewards children={childrenWithBalances} />;
    }

    // Validate selected child exists
    const targetChild = children.find((c) => c.id === selectedChildId);
    if (!targetChild) {
      return (
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-lg font-medium text-slate-600">Child not found</p>
        </div>
      );
    }

    targetMemberId = targetChild.id;
  } else {
    // Non-managers view their own rewards
    targetMemberId = member.id;
  }

  // Fetch all data in parallel for the target member
  const [rewards, balance, transactions, primaryGoal] = await Promise.all([
    getRewardsForFamily(familyId),
    getBalance(targetMemberId),
    getHistory(targetMemberId, { limit: 10, offset: 0 }),
    getPrimaryGoal(targetMemberId),
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
          memberId={targetMemberId}
          initialData={initialData}
          isManager={isManager}
          allChildren={allChildren}
        >
          <RewardStorePage />
        </RewardStoreProvider>
      </div>
    </div>
  );
}
