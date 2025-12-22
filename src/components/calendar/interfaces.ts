import type { TEventColor } from "@/components/calendar/types";

export interface IUser {
  id: string;
  name: string;
  avatarFallback: string;
  avatarColor: string;
  avatarUrl?: string;
}

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  users: IUser[];
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
