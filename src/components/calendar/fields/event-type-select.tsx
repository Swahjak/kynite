"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Calendar, Cake, Clock, CheckSquare, Bell } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type TEventType, EVENT_TYPES } from "@/components/calendar/types";

interface EventTypeSelectProps {
  value: TEventType;
  onValueChange: (value: TEventType) => void;
  disabled?: boolean;
}

const typeIcons: Record<TEventType, React.ReactNode> = {
  event: <Calendar className="h-4 w-4" />,
  birthday: <Cake className="h-4 w-4" />,
  appointment: <Clock className="h-4 w-4" />,
  task: <CheckSquare className="h-4 w-4" />,
  reminder: <Bell className="h-4 w-4" />,
};

export function EventTypeSelect({
  value,
  onValueChange,
  disabled = false,
}: EventTypeSelectProps) {
  const t = useTranslations("EventTypes");

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TEventType)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          <div className="flex items-center gap-2">
            {typeIcons[value]}
            <span>{t(value)}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {EVENT_TYPES.map((eventType) => (
          <SelectItem key={eventType} value={eventType}>
            <div className="flex items-center gap-2">
              {typeIcons[eventType]}
              <span>{t(eventType)}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
