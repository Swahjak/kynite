import type { TEventColor } from "@/components/calendar/types";

export interface IUser {
  id: string;
  name: string;
  avatarFallback: string;
  avatarColor: string | null;
  avatarUrl?: string;
  avatarSvg?: string | null;
}

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  users: IUser[];
  isHidden?: boolean;
  eventType?: string | null;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
