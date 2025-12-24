"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
  isToday,
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
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const dayRefs = useRef<(HTMLDivElement | null)[]>([]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Find today's index in the week
  const todayIndex = weekDays.findIndex((day) => isToday(day));

  // Scroll to today on mobile
  useEffect(() => {
    if (todayIndex < 0 || todayIndex >= weekDays.length) return;

    const targetRef = dayRefs.current[todayIndex];
    if (targetRef && mobileScrollRef.current) {
      targetRef.scrollIntoView({ behavior: "instant", inline: "center" });
    }
  }, [todayIndex, weekDays.length, currentDate]);

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

      {/* Mobile week view - horizontal scroll with 80% columns */}
      <div
        ref={mobileScrollRef}
        className="flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden md:hidden"
        role="region"
        aria-label="Week calendar - swipe to navigate between days"
      >
        <div className="flex h-full gap-4" style={{ width: "560%" }}>
          {weekDays.map((day, index) => (
            <div
              key={day.toISOString()}
              ref={(el) => {
                dayRefs.current[index] = el;
              }}
              className="h-full w-[80vw] flex-shrink-0 snap-center"
            >
              <DayColumn
                date={day}
                events={filteredEvents}
                chores={chores}
                onCompleteChore={completeChore}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop week grid */}
      <div className="hidden flex-1 overflow-x-auto md:block">
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
