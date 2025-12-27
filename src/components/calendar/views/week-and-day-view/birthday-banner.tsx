import { Cake } from "lucide-react";
import type { IEvent } from "@/components/calendar/interfaces";
import { EventDetailsDialog } from "@/components/calendar/dialogs/event-details-dialog";

interface BirthdayBannerProps {
  events: IEvent[];
}

export function BirthdayBanner({ events }: BirthdayBannerProps) {
  const birthdayEvents = events.filter((e) => e.eventType === "birthday");

  if (birthdayEvents.length === 0) return null;

  return (
    <div className="flex border-b bg-red-50 dark:bg-red-950/30">
      <div className="flex w-18 items-center justify-end pr-2">
        <Cake className="size-4 text-red-500" />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2 border-l border-red-200 px-2 py-2 dark:border-red-800">
        {birthdayEvents.map((event) => (
          <EventDetailsDialog key={event.id} event={event}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
            >
              <Cake className="size-3" />
              <span className="max-w-32 truncate">{event.title}</span>
            </button>
          </EventDetailsDialog>
        ))}
      </div>
    </div>
  );
}
