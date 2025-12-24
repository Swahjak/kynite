import type {
  DashboardData,
  DashboardEvent,
  Timer,
  FamilyMemberStar,
  QuickAction,
} from "./types";

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const MOCK_EVENTS: DashboardEvent[] = [
  {
    id: "1",
    title: "Zwemles",
    startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9:00
    endTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00
    location: "Sportcentrum De Kuil",
    category: "sports",
  },
  {
    id: "2",
    title: "Huiswerk maken",
    startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 14:00
    endTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 15:00
    category: "school",
  },
  {
    id: "3",
    title: "Avondeten",
    startTime: new Date(today.getTime() + 18 * 60 * 60 * 1000), // 18:00
    endTime: new Date(today.getTime() + 19 * 60 * 60 * 1000), // 19:00
    location: "Thuis",
    category: "meal",
  },
  {
    id: "4",
    title: "Voorlezen",
    startTime: new Date(today.getTime() + 19.5 * 60 * 60 * 1000), // 19:30
    endTime: new Date(today.getTime() + 20 * 60 * 60 * 1000), // 20:00
    category: "reading",
  },
];

export const MOCK_TIMERS: Timer[] = [
  {
    id: "t1",
    title: "Schermtijd",
    subtitle: "iPad - Emma",
    remainingSeconds: 1200, // 20 min
    totalSeconds: 1800, // 30 min
    category: "screen",
    status: "running",
    starReward: 0,
    alertMode: "completion",
    cooldownSeconds: null,
    assignedToId: null,
    ownerDeviceId: null,
  },
  {
    id: "t2",
    title: "Opruimen",
    subtitle: "Slaapkamer",
    remainingSeconds: 540, // 9 min
    totalSeconds: 900, // 15 min
    category: "chore",
    status: "running",
    starReward: 10,
    alertMode: "completion",
    cooldownSeconds: 60,
    assignedToId: null,
    ownerDeviceId: null,
  },
];

export const MOCK_FAMILY_MEMBERS: FamilyMemberStar[] = [
  {
    id: "m1",
    name: "Emma",
    avatarColor: "purple",
    weeklyStarCount: 24,
    level: 2,
    levelTitle: "Explorer",
  },
  {
    id: "m2",
    name: "Lucas",
    avatarColor: "blue",
    weeklyStarCount: 18,
    level: 1,
    levelTitle: "Beginner",
  },
  {
    id: "m3",
    name: "Sophie",
    avatarColor: "pink",
    weeklyStarCount: 31,
    level: 3,
    levelTitle: "Artist",
  },
];

export const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa1",
    label: "Etenstijd",
    icon: "Utensils",
    category: "meal",
    timerDuration: 1800,
  },
  {
    id: "qa2",
    label: "Planten water",
    icon: "Droplets",
    category: "chore",
    timerDuration: 300,
  },
  {
    id: "qa3",
    label: "15m Opruimen",
    icon: "Sparkles",
    category: "chore",
    timerDuration: 900,
  },
  { id: "qa4", label: "Klusje loggen", icon: "CheckCircle", category: "log" },
];

export const MOCK_DASHBOARD_DATA: DashboardData = {
  familyName: "Familie de Vries",
  todaysEvents: MOCK_EVENTS,
  todaysChores: [],
  activeTimers: MOCK_TIMERS,
  familyMembers: MOCK_FAMILY_MEMBERS,
  quickActions: MOCK_QUICK_ACTIONS,
};
