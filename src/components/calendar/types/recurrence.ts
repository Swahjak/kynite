export type TRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type TRecurrenceEndType = "never" | "count" | "date";

export interface IRecurrence {
  frequency: TRecurrenceFrequency;
  interval: number;
  endType: TRecurrenceEndType;
  endCount?: number;
  endDate?: string;
}

export const RECURRENCE_FREQUENCIES: {
  value: TRecurrenceFrequency;
  label: string;
}[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

export const RECURRENCE_END_TYPES: {
  value: TRecurrenceEndType;
  label: string;
}[] = [
  { value: "never", label: "Never" },
  { value: "count", label: "After" },
  { value: "date", label: "On date" },
];
