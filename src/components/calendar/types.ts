export type TCalendarView = "day" | "week" | "month" | "year" | "agenda";
export type TEventColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "teal";

export type TEventCategory =
  | "sports"
  | "work"
  | "school"
  | "family"
  | "social"
  | "home";

export type TEventType =
  | "event"
  | "birthday"
  | "appointment"
  | "task"
  | "reminder";

export type TRegion = "US" | "GB" | "NL" | "DE" | "FR" | "ES" | "IT" | "BE";

export const CATEGORY_COLORS: Record<TEventCategory, TEventColor> = {
  sports: "green",
  work: "blue",
  school: "yellow",
  family: "purple",
  social: "pink",
  home: "orange",
};

export const CATEGORY_ICONS: Record<TEventCategory, string> = {
  sports: "activity",
  work: "briefcase",
  school: "graduation-cap",
  family: "users",
  social: "message-circle",
  home: "home",
};

export const EVENT_TYPE_ICONS: Record<TEventType, string> = {
  event: "calendar",
  birthday: "cake",
  appointment: "clock",
  task: "check-square",
  reminder: "bell",
};

export interface RegionConfig {
  dateFormat: string;
  timeFormat12h: boolean;
  dateFnsLocale: string;
}

export const REGION_CONFIGS: Record<TRegion, RegionConfig> = {
  US: { dateFormat: "MM/dd/yyyy", timeFormat12h: true, dateFnsLocale: "en-US" },
  GB: {
    dateFormat: "dd/MM/yyyy",
    timeFormat12h: false,
    dateFnsLocale: "en-GB",
  },
  NL: { dateFormat: "dd-MM-yyyy", timeFormat12h: false, dateFnsLocale: "nl" },
  DE: { dateFormat: "dd.MM.yyyy", timeFormat12h: false, dateFnsLocale: "de" },
  FR: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "fr" },
  ES: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "es" },
  IT: { dateFormat: "dd/MM/yyyy", timeFormat12h: false, dateFnsLocale: "it" },
  BE: {
    dateFormat: "dd/MM/yyyy",
    timeFormat12h: false,
    dateFnsLocale: "nl-BE",
  },
};

export const REGIONS: TRegion[] = [
  "US",
  "GB",
  "NL",
  "DE",
  "FR",
  "ES",
  "IT",
  "BE",
];
export const CATEGORIES: TEventCategory[] = [
  "sports",
  "work",
  "school",
  "family",
  "social",
  "home",
];
export const EVENT_TYPES: TEventType[] = [
  "event",
  "birthday",
  "appointment",
  "task",
  "reminder",
];
