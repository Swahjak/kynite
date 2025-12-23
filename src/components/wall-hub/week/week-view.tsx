"use client";

import { useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { DayColumn } from "./day-column";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";

export function WeekView() {
  const { users, events, selectedUserId, filterEventsBySelectedUser } =
    useCalendar();
  const { chores, completeChore } = useChores();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredEvents = useMemo(() => {
    if (selectedUserId === "all") return events;
    return events.filter((event) =>
      event.users.some((u) => u.id === selectedUserId)
    );
  }, [events, selectedUserId]);

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Header with filters and navigation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PersonFilterChips
          users={users}
          selectedUserId={selectedUserId}
          onSelect={filterEventsBySelectedUser}
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-xl font-bold lg:text-2xl">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
          </h2>
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="size-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid min-w-[800px] grid-cols-7 gap-4">
          {weekDays.map((day) => (
            <DayColumn
              key={day.toISOString()}
              date={day}
              events={filteredEvents}
              chores={chores}
              onCompleteChore={completeChore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
