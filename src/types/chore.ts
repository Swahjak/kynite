import type { FamilyMemberWithUser } from "./family";

// =============================================================================
// Enums
// =============================================================================

export type ChoreStatus = "pending" | "completed" | "skipped";
export type ChoreRecurrence =
  | "once"
  | "daily"
  | "weekly"
  | "weekdays"
  | "weekends"
  | "monthly";
export type UrgencyStatus = "none" | "due-soon" | "urgent" | "overdue";

export const CHORE_STATUSES: ChoreStatus[] = [
  "pending",
  "completed",
  "skipped",
];
export const CHORE_RECURRENCES: ChoreRecurrence[] = [
  "once",
  "daily",
  "weekly",
  "weekdays",
  "weekends",
  "monthly",
];

// =============================================================================
// Interfaces
// =============================================================================

export interface IChore {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  recurrence: ChoreRecurrence;
  isUrgent: boolean;
  status: ChoreStatus;
  starReward: number;
  completedAt: Date | null;
  completedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChoreWithAssignee extends IChore {
  assignedTo: FamilyMemberWithUser | null;
  completedBy: FamilyMemberWithUser | null;
}

export interface IChoreProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface IChoreStreak {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
}

// =============================================================================
// Filter Types
// =============================================================================

export type ChoreViewFilter = "all" | "by-person" | "urgent";

export interface ChoreFilters {
  status?: ChoreStatus;
  assignedToIds?: string[];
  isUrgent?: boolean;
  startDate?: string;
  endDate?: string;
}
