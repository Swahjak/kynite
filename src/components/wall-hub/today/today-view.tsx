"use client";

import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { PersonColumn } from "./person-column";

export function TodayView() {
  const { users, events } = useCalendar();
  const { chores, completeChore } = useChores();

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((user) => (
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
  );
}
