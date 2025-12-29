export type EventState = "past" | "now" | "upcoming";

export interface DashboardEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  category: string;
  state?: EventState;
}

export interface Timer {
  id: string;
  title: string;
  subtitle: string;
  remainingSeconds: number;
  totalSeconds: number;
  category: string;
  status: "running" | "paused" | "completed" | "expired" | "cancelled";
  starReward: number;
  alertMode: "none" | "completion" | "escalating";
  cooldownSeconds: number | null;
  assignedToId: string | null;
  ownerDeviceId: string | null;
  completedAt: Date | null;
}

export interface FamilyMemberStar {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarColor: string;
  avatarSvg?: string | null;
  weeklyStarCount: number;
  level: number;
  levelTitle: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  category: string;
  timerDuration?: number;
}

export type ChoreUrgency = "overdue" | "urgent" | "due-soon" | "none";

export interface DashboardChore {
  id: string;
  title: string;
  dueTime: string | null;
  urgency: ChoreUrgency;
  assignee: {
    name: string;
    avatarColor: string;
  } | null;
  starReward: number;
}

export interface DashboardData {
  familyId: string;
  familyName: string;
  todaysEvents: DashboardEvent[];
  todaysChores: DashboardChore[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
}
