export type EventState = "NOW" | "NEXT" | "LATER";

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
}

export interface FamilyMemberStar {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
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

export interface DashboardData {
  familyName: string;
  todaysEvents: DashboardEvent[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
}
