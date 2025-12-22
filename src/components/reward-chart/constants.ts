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

export const TASK_ICONS = [
  { icon: "dentistry", label: "Brush Teeth" },
  { icon: "bed", label: "Make Bed" },
  { icon: "restaurant", label: "Eat/Table" },
  { icon: "menu_book", label: "Reading" },
  { icon: "checkroom", label: "Clothes/PJs" },
  { icon: "music_note", label: "Practice Music" },
  { icon: "pets", label: "Pet Care" },
  { icon: "school", label: "Homework" },
  { icon: "shower", label: "Shower/Bath" },
  { icon: "backpack", label: "Pack Bag" },
  { icon: "fitness_center", label: "Exercise" },
  { icon: "cleaning_services", label: "Clean Room" },
] as const;

export const DEFAULT_TASKS = [
  {
    title: "Brush Teeth AM",
    icon: "dentistry",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Brush Teeth PM",
    icon: "dentistry",
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
    icon: "menu_book",
    iconColor: "orange",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "PJs On",
    icon: "checkroom",
    iconColor: "pink",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
] as const;
