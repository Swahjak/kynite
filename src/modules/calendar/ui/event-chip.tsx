'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CategoryDot } from '@/components/kynite';
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
  /**
   * Asked once per click, before `onSelect`. A pointer gesture that actually
   * moved still ends in a synthetic `click`, and opening the editor from it
   * would seed the dialog with the *pre-drag* times — saving would then quietly
   * undo the reschedule the user just performed. The drag hook owns the
   * "did this move?" fact, so it answers this rather than the chip guessing.
   */
  suppressClick?: () => boolean;
  /** The block starts before the rendered grid window — draw the clip cue. */
  continuesBefore?: boolean;
  /** The block ends after the rendered grid window. */
  continuesAfter?: boolean;
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
  suppressClick,
  continuesBefore = false,
  continuesAfter = false,
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
      // `calendar.md` § "Month view / date picker": "a `4px × 4px` dot at
      // `border-radius:9999px;background:oklch(58% 0.14 H)`" — a round pip in
      // the day's category hue, not a bar. It was `h-1.5 w-full`, which drew a
      // stretched lozenge; the size now comes from the shared `CategoryDot`
      // (`size-1` = the documented 4px) and the hue from the same solid token
      // the event card's rule uses.
      <CategoryDot
        data-slot="event-dot"
        data-category={event.category}
        aria-hidden={undefined}
        title={title}
        size="xs"
        className={cn(palette.solid, className)}
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
      data-continues-before={continuesBefore || undefined}
      data-continues-after={continuesAfter || undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={
        interactive
          ? () => {
              if (suppressClick?.()) return;
              onSelect(event);
            }
          : undefined
      }
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
        // The design system's event card: a `oklch(94% 0.025 H)` tint carrying
        // a 4px left rule in the category's *solid* hue (`calendar.md` §
        // "Event list item": "Category color bar: `width:4px;…;background:
        // oklch(58% 0.14 H)`"). The rule used to take `palette.border`, which
        // is the pale `oklch(85% 0.05 H)` **chip outline** — a tenth of the
        // contrast the bar is drawn at in the spec.
        'group/chip relative flex min-w-0 flex-col justify-start gap-0.5 overflow-hidden rounded-lg border-l-4 px-2 py-1 text-left shadow-sm',
        palette.surface,
        palette.rule,
        variant === 'block' && 'absolute inset-x-1 select-none',
        hub ? 'gap-1 px-3 py-2' : '',
        interactive &&
          'cursor-pointer transition-all duration-200 ease-brand hover:-translate-y-px hover:shadow-md',
        // The press convention (`components.md`: every interactive shape is
        // pressed, not just hovered). Not on a `block`, whose `transform` is
        // owned by the drag hook — a `scale` class there would be overwritten
        // mid-gesture by the inline `translateX`, i.e. visibly flicker.
        interactive && variant !== 'block' && 'active:scale-95',
        // Free/busy blocks are deliberately quieter than the events you can
        // actually read — they are context, not information. The recede is on
        // the *fill and border*, not the whole chip: `opacity-70` on the
        // container took the "Bezet" label's text down with it, the same
        // contrast hazard the past-event treatment in `person-columns.tsx`
        // was fixed for in M17 — draining the category tint to a neutral
        // surface reads as "just context" just as well and leaves the label
        // legible. The dashed border stays; it is the shape cue, not the
        // contrast problem.
        event.busyOnly && 'border-dashed border-line bg-surface/60',
        className
      )}
    >
      {/* Clip cues: the grid renders `GRID_START_HOUR`–`GRID_END_HOUR`, so a
          block reaching outside that window is drawn against the edge. Without
          a mark it would read as starting at 06:00 / ending at 23:00, which is
          a different fact from the one in the database. */}
      {continuesBefore && (
        <Icon
          name="arrow_upward"
          size="xs"
          label={t('continuesBefore')}
          className={cn('absolute top-0.5 right-0.5 opacity-70', palette.text)}
        />
      )}
      {continuesAfter && (
        <Icon
          name="arrow_downward"
          size="xs"
          label={t('continuesAfter')}
          className={cn('absolute right-0.5 bottom-0.5 opacity-70', palette.text)}
        />
      )}

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
            // No `opacity-*` on coloured text: an 80% blend of
            // `--cat-blue-fg` over its own tint lands at 4.13:1, which is a
            // WCAG AA failure the M17 axe sweep caught the moment `cn()`
            // stopped silently dropping `palette.text` (see `lib/utils.ts`).
            // The chip is already visually secondary through size and tint.
            'tabular-time truncate',
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
        <span className={cn('flex min-w-0 items-center gap-1 text-caption', palette.text)}>
          <Icon name="location_on" size="xs" className="shrink-0" />
          <span className="truncate">{event.location}</span>
        </span>
      )}
    </div>
  );
}
