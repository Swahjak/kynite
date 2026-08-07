'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import type { CalendarEvent } from '../queries';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS } from './tokens';

/**
 * Mirrors `UNTITLED` in `modules/google/domain/mapping.ts` — not imported
 * from there, deliberately: that slice is the Google sync integration, and
 * this calendar-UI component has no business depending on it for anything
 * but a string constant. Both sides are covered by
 * `tests/unit/i18n/hardcoded-strings.test.ts`-adjacent unit coverage on the
 * mapping module, so a drift between the two literals fails loudly.
 */
const UNTITLED_SENTINEL = '(no title)';

/**
 * One event, as it appears in every view. The chip is the single place that
 * decides how an event *reads*, so a busy-only block, a pending-sync pip and a
 * recurring instance look the same in the day grid as in the agenda list.
 */

export type EventChipProps = {
  event: CalendarEvent;
  /** `block` fills a time-grid slot; `row` is a list line; `dot` is a month pip. */
  variant?: 'block' | 'row' | 'dot';
  /** Hub surfaces render at 6-foot legibility. */
  hub?: boolean;
  showTime?: boolean;
  onSelect?: (event: CalendarEvent) => void;
  /** Drag start, for the time-grid blocks that can be rescheduled. */
  onPointerDown?: (pointerEvent: React.PointerEvent<HTMLElement>, event: CalendarEvent) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function EventChip({
  event,
  variant = 'row',
  hub = false,
  showTime = true,
  onSelect,
  onPointerDown,
  className,
  style,
}: EventChipProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const palette = CATEGORY_CLASSES[event.category];

  // A redacted event has no title to show — it is a shape in the day, which is
  // exactly what free/busy means (§7 `calendar:view_private` → `busy-only`).
  //
  // A synced Google event with no summary persists the `UNTITLED` sentinel
  // (`modules/google/domain/mapping.ts`) into `event.title` — deliberately:
  // the row needs *a* string, and re-deriving "was this untitled?" from an
  // empty string at read time would be one more place to get it wrong. The
  // sentinel is translated here, at the UI boundary, the same way `busy-only`
  // is — not stored pre-translated, which would hardcode English into the
  // database for every locale a family ever opens the event in.
  const title = event.busyOnly
    ? t('busy')
    : event.title === UNTITLED_SENTINEL
      ? t('untitled')
      : event.title;

  if (variant === 'dot') {
    return (
      <span
        data-slot="event-dot"
        data-category={event.category}
        title={title}
        className={cn('block h-1.5 w-full rounded-full', palette.solid, className)}
      />
    );
  }

  const interactive = onSelect !== undefined && event.editable;

  return (
    <div
      data-slot="event-chip"
      data-category={event.category}
      data-busy-only={event.busyOnly || undefined}
      data-pending-sync={event.pendingSync || undefined}
      data-recurring={event.recurring || undefined}
      data-event-id={event.seriesId}
      data-occurrence-start={event.startsAt.toISOString()}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onSelect(event) : undefined}
      onPointerDown={
        onPointerDown ? (pointerEvent) => onPointerDown(pointerEvent, event) : undefined
      }
      onKeyDown={
        interactive
          ? (keyboardEvent) => {
              if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
                keyboardEvent.preventDefault();
                onSelect(event);
              }
            }
          : undefined
      }
      style={style}
      className={cn(
        'group/chip relative flex min-w-0 flex-col justify-start gap-0.5 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left',
        palette.surface,
        palette.border,
        variant === 'block' && 'absolute inset-x-1 select-none',
        hub ? 'gap-1 px-3 py-2' : '',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md',
        // Free/busy blocks are deliberately quieter than the events you can
        // actually read — they are context, not information.
        event.busyOnly && 'border-dashed opacity-70',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        {!event.busyOnly && (
          <Icon
            name={EVENT_TYPE_ICONS[event.eventType]}
            size={hub ? 'sm' : 'xs'}
            className={cn('shrink-0', palette.text)}
          />
        )}
        <span
          className={cn(
            'truncate font-display font-semibold',
            palette.text,
            hub ? 'text-body-lg' : 'text-caption'
          )}
        >
          {title}
        </span>

        {/* Non-blocking sync pip (§5): the edit landed locally, Google has not
            caught up yet. Never a modal, never an error — a dot. */}
        {event.pendingSync && (
          <span
            data-testid="pending-sync-pip"
            title={t('pendingSync')}
            aria-label={t('pendingSync')}
            role="img"
            className="ml-auto size-1.5 shrink-0 rounded-full bg-warning"
          />
        )}
        {event.recurring && !event.pendingSync && (
          <Icon
            name="repeat"
            size="xs"
            label={t('recurring')}
            className={cn('ml-auto shrink-0 opacity-60', palette.text)}
          />
        )}
      </div>

      {showTime && !event.allDay && (
        <span
          className={cn(
            'tabular-time truncate opacity-80',
            palette.text,
            hub ? 'text-body' : 'text-caption'
          )}
        >
          {format.dateTime(event.startsAt, { hour: '2-digit', minute: '2-digit' })}
          {' – '}
          {format.dateTime(event.endsAt, { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}

      {event.location && variant !== 'block' && (
        <span className={cn('truncate text-caption opacity-70', palette.text)}>
          {event.location}
        </span>
      )}
    </div>
  );
}
