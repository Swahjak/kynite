"use client";

import { useMemo } from "react";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { PersonColumn } from "./person-column";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";

export function TodayView() {
  const { users, events, selectedUserId, filterEventsBySelectedUser } =
    useCalendar();
  const { chores, completeChore } = useChores();

  // Filter users based on selection
  const displayedUsers = useMemo(() => {
    if (selectedUserId === "all") return users;
    return users.filter((user) => user.id === selectedUserId);
  }, [users, selectedUserId]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PersonFilterChips
          people={users}
          selectedId={selectedUserId}
          onSelect={filterEventsBySelectedUser}
        />
      </div>

      {/* Mobile view - horizontal scroll with snap */}
      <div
        className="min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto md:hidden"
        role="region"
        aria-label="Today view - swipe to navigate between people"
      >
        <div className="flex h-full gap-3 px-1">
          {displayedUsers.map((user) => (
            <div
              key={user.id}
              className="h-full w-72 flex-shrink-0 snap-center"
            >
              <PersonColumn
                user={user}
                events={events}
                chores={chores}
                onCompleteChore={completeChore}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Desktop view - grid */}
      <div className="hidden min-h-0 flex-1 overflow-x-auto md:block">
        <div className="grid min-w-[600px] grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {displayedUsers.map((user) => (
            <PersonColumn
              key={user.id}
              user={user}
              events={events}
              chores={chores}
              onCompleteChore={completeChore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
