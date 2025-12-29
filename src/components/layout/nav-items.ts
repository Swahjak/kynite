import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Settings,
  HelpCircle,
  Star,
  Gift,
  Timer,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  labelKey:
    | "dashboard"
    | "calendar"
    | "chores"
    | "timers"
    | "rewardChart"
    | "rewards"
    | "settings"
    | "help";
  manageOnly?: boolean;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
  { href: "/calendar/today", icon: Calendar, labelKey: "calendar" },
  { href: "/chores", icon: CheckSquare, labelKey: "chores", manageOnly: true },
  { href: "/timers", icon: Timer, labelKey: "timers", manageOnly: true },
  { href: "/reward-chart", icon: Star, labelKey: "rewardChart" },
  { href: "/rewards", icon: Gift, labelKey: "rewards" },
  { href: "/settings", icon: Settings, labelKey: "settings", manageOnly: true },
];

export const helpItem: NavItem = {
  href: "/help",
  icon: HelpCircle,
  labelKey: "help",
};
