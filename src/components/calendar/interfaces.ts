import type { TEventCategory, TEventType } from "@/components/calendar/types";
import type { IRecurrence } from "@/components/calendar/types/recurrence";

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
  // Recurrence support
  recurringPatternId?: string;
  occurrenceDate?: string;
  recurrence?: IRecurrence;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
