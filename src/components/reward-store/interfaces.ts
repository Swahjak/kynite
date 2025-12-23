import type { LimitType } from "@/lib/validations/reward";

export interface IReward {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  emoji: string;
  starCost: number;
  limitType: LimitType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRedemption {
  id: string;
  rewardId: string;
  memberId: string;
  starCost: number;
  redeemedAt: Date;
  reward?: {
    title: string;
    emoji: string;
  };
}

export interface IRewardWithStatus extends IReward {
  canRedeem: boolean;
  reason?: "insufficient_stars" | "limit_reached";
  starsNeeded?: number;
  nextAvailable?: Date;
}

export interface IStarTransaction {
  id: string;
  amount: number;
  type: "reward_chart" | "chore" | "bonus" | "redemption";
  description: string;
  createdAt: Date;
}

export type CreateRewardInput = {
  title: string;
  description?: string | null;
  emoji: string;
  starCost: number;
  limitType?: LimitType;
};

export type UpdateRewardInput = Partial<CreateRewardInput> & {
  isActive?: boolean;
};
