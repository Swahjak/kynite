import type { FamilyMember } from "@/server/schema";

// =============================================================================
// CORE TYPES
// =============================================================================

export type CompletionStatus = "completed" | "missed" | "skipped";
export type GoalStatus = "active" | "achieved" | "cancelled";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CellStatus =
  | "completed"
  | "pending"
  | "missed"
  | "future"
  | "not_applicable";

// =============================================================================
// ENTITIES
// =============================================================================

export interface IRewardChart {
  id: string;
  familyId: string;
  memberId: string;
  member: FamilyMember | null;
  isActive: boolean;
  tasks: IRewardChartTask[];
  activeGoal: IRewardChartGoal | null;
  currentMessage: IRewardChartMessage | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: DayOfWeek[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IRewardChartCompletion {
  id: string;
  taskId: string;
  date: string;
  status: CompletionStatus;
  completedAt: Date | null;
  createdAt: Date;
}

export interface IRewardChartGoal {
  id: string;
  chartId: string;
  title: string;
  description?: string | null;
  emoji: string;
  starTarget: number;
  starsCurrent: number;
  status: GoalStatus;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRewardChartMessage {
  id: string;
  chartId: string;
  content: string;
  authorId: string;
  author?: FamilyMember | null;
  isActive: boolean;
  createdAt: Date;
}

// =============================================================================
// CHILD CHART INFO (for person filter chips)
// =============================================================================

export interface ChildChartInfo {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  chartId: string | null;
  totalStars: number;
}

// =============================================================================
// VIEW MODELS
// =============================================================================

export interface WeekDay {
  date: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface TaskCell {
  date: string;
  status: CellStatus;
  completion: IRewardChartCompletion | null;
  isApplicable: boolean;
}

export interface TaskRow {
  task: IRewardChartTask;
  cells: TaskCell[];
}

export interface TodayStats {
  completed: number;
  total: number;
}

export interface WeeklyChartData {
  chart: IRewardChart;
  weekStart: string;
  weekEnd: string;
  days: WeekDay[];
  tasks: TaskRow[];
  todayStats: TodayStats;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface GoalProgress {
  starsCurrent: number;
  starTarget: number;
  progressPercent: number;
  achieved?: boolean;
}

export interface CompleteTaskResponse {
  completion: IRewardChartCompletion;
  goalProgress: GoalProgress | null;
  starsEarned: number;
}

export interface UndoCompletionResponse {
  goalProgress: GoalProgress | null;
  starsRemoved: number;
}

// =============================================================================
// MUTATION INPUTS
// =============================================================================

export interface CreateTaskInput {
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: number[];
}

export interface UpdateTaskInput {
  title?: string;
  icon?: string;
  iconColor?: string;
  starValue?: number;
  daysOfWeek?: number[];
}

export interface CreateGoalInput {
  title: string;
  emoji: string;
  starTarget: number;
  description?: string;
}

export interface UpdateGoalInput {
  title?: string;
  emoji?: string;
  starTarget?: number;
  description?: string | null;
  status?: "active" | "achieved" | "cancelled";
}
