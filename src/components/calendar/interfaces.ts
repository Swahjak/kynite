import type { TEventCategory, TEventType } from "@/components/calendar/types";

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
  description: string;
  users: IUser[];
  isHidden?: boolean;
  // New/updated fields
  category: TEventCategory;
  eventType: TEventType;
  allDay: boolean;
  isCompleted?: boolean;
  ownerId?: string;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
