import type { LucideIcon } from "lucide-react";
import {
  Backpack,
  Bed,
  BookOpen,
  Dumbbell,
  GraduationCap,
  Music,
  PawPrint,
  Shirt,
  ShowerHead,
  Smile,
  Sparkles,
  Utensils,
  HelpCircle,
} from "lucide-react";

export const ICON_COLORS = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    darkBg: "dark:bg-blue-950",
    darkText: "dark:text-blue-400",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    darkBg: "dark:bg-emerald-950",
    darkText: "dark:text-emerald-400",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    darkBg: "dark:bg-purple-950",
    darkText: "dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    darkBg: "dark:bg-orange-950",
    darkText: "dark:text-orange-400",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-600",
    darkBg: "dark:bg-pink-950",
    darkText: "dark:text-pink-400",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    darkBg: "dark:bg-amber-950",
    darkText: "dark:text-amber-400",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    darkBg: "dark:bg-teal-950",
    darkText: "dark:text-teal-400",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    darkBg: "dark:bg-rose-950",
    darkText: "dark:text-rose-400",
  },
} as const;

export type IconColorKey = keyof typeof ICON_COLORS;

export interface TaskIconOption {
  icon: LucideIcon;
  key: string;
  label: string;
}

export const TASK_ICONS: TaskIconOption[] = [
  { icon: Smile, key: "smile", label: "Brush Teeth" },
  { icon: Bed, key: "bed", label: "Make Bed" },
  { icon: Utensils, key: "utensils", label: "Eat/Table" },
  { icon: BookOpen, key: "book-open", label: "Reading" },
  { icon: Shirt, key: "shirt", label: "Clothes/PJs" },
  { icon: Music, key: "music", label: "Practice Music" },
  { icon: PawPrint, key: "paw-print", label: "Pet Care" },
  { icon: GraduationCap, key: "graduation-cap", label: "Homework" },
  { icon: ShowerHead, key: "shower-head", label: "Shower/Bath" },
  { icon: Backpack, key: "backpack", label: "Pack Bag" },
  { icon: Dumbbell, key: "dumbbell", label: "Exercise" },
  { icon: Sparkles, key: "sparkles", label: "Clean Room" },
];

// Legacy Material Symbols name to new key mapping
const LEGACY_ICON_MAP: Record<string, string> = {
  dentistry: "smile",
  restaurant: "utensils",
  menu_book: "book-open",
  checkroom: "shirt",
  music_note: "music",
  pets: "paw-print",
  school: "graduation-cap",
  shower: "shower-head",
  fitness_center: "dumbbell",
  cleaning_services: "sparkles",
};

/** Get icon component by key, with legacy Material Symbols fallback */
export function getTaskIconByKey(iconKey: string): LucideIcon {
  const normalizedKey = LEGACY_ICON_MAP[iconKey] ?? iconKey;
  const found = TASK_ICONS.find((item) => item.key === normalizedKey);
  return found?.icon ?? HelpCircle;
}

export const DEFAULT_TASKS = [
  {
    title: "Brush Teeth AM",
    icon: "smile",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Brush Teeth PM",
    icon: "smile",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Make Bed",
    icon: "bed",
    iconColor: "emerald",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Read 15 Minutes",
    icon: "book-open",
    iconColor: "orange",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "PJs On",
    icon: "shirt",
    iconColor: "pink",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
] as const;
