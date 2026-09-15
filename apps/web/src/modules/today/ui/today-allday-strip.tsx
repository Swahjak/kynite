import { Icon } from '@kynite/ui';
import { EVENT_TYPE_ICONS, type CalendarEvent } from '@/modules/calendar';

export type TodayAllDayStripProps = {
  events: CalendarEvent[];
  label: string;
};

/**
 * All-day events, pulled out of the timeline into one strip above it — they
 * have no time to sit in a chronological list next to.
 */
export function TodayAllDayStrip({ events, label }: TodayAllDayStripProps) {
  if (events.length === 0) return null;

  return (
    <ul
      data-testid="today-allday-strip"
      aria-label={label}
      className="flex flex-wrap gap-2 px-1 pb-3"
    >
      {events.map((event) => (
        <li
          key={event.key}
          className="flex items-center gap-1.5 rounded-full border border-line-subtle bg-card px-3 py-1.5 text-sm font-semibold text-ink"
        >
          <Icon name={EVENT_TYPE_ICONS[event.eventType]} size="xs" />
          {event.title}
        </li>
      ))}
    </ul>
  );
}
