'use client';

import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Badge, cn } from '@kynite/ui';
import { CategoryDot } from '@/components/kynite';
import type { CalendarEvent } from '../queries';
import { CATEGORY_CLASSES } from './tokens';

/**
 * `docs/design/calendar.md` § "Day agenda", literally.
 *
 * This replaces the "Event list item" row the today board used to draw
 * (`event-row.tsx`, deleted with this change — no surface was left on the
 * other side of the swap). The design system draws two different things here,
 * and the board had been drawing the wrong one:
 *
 * | | Event list item | **Day agenda** |
 * | --- | --- | --- |
 * | leading cue | 4px category bar | **8px category dot before the title** |
 * | time | start over end, 56px column | **start only**, 44px centred column |
 * | between rows | 1px full-width divider | **1px vertical connector**, under the time |
 * | sub-label | location | **who it is for** |
 * | current event | — | **tinted row + NOW badge** |
 *
 * The differences are not decoration. A vertical timeline reads as *one day
 * going past*, which is what the today screen is for; a list of divided rows
 * reads as a table of records, which is what the calendar's agenda view is
 * for. And the sub-label is the difference between "where is this" and "whose
 * is this" — on a family board, the second question is the one being asked,
 * and the faces alone cannot answer it for a four-person dinner.
 *
 * Measurements map as: 44px time column = `w-11`, 14px gap = `gap-3.5`, 13px
 * time label = `text-caption` (12px, the nearest declared step — the scale has
 * no 13px), 1px connector at `#c4c5d9` = `bg-line-strong`, 8px dot =
 * `CategoryDot size="md"`, 14px title = `text-body-sm`, 12px sub-label =
 * `text-caption` at `--ink-secondary`, and the current row's tint is
 * `rgba(93,95,239,0.06)` = `bg-primary/6`.
 *
 * **Past rows recede through colour, not opacity.** The spec says
 * `opacity:0.55` on the whole row; M17 found that an opacity on a container
 * holding text is what drops it under the contrast floor on the hub's viewing
 * distance. Muting the title and the dot is the same intent at a legible
 * contrast, and it is the substitution this codebase already made everywhere
 * else a past event recedes.
 */

export type DayAgendaRowProps = {
  event: CalendarEvent;
  /**
   * Who the event is for, already resolved to display names — the sub-label.
   * Empty renders "Iedereen", which is what an event nobody claimed *is*.
   */
  people?: string[];
  /** It is happening now: tinted surface, indigo time, NOW badge. */
  current?: boolean;
  /** It has already finished. */
  past?: boolean;
  /** Last row in its list: the connector stops here rather than dangling. */
  last?: boolean;
  /** Hub surfaces render at 6-foot legibility — one step up the same scale. */
  hub?: boolean;
  onSelect?: (event: CalendarEvent) => void;
};

/** Mirrors `EventChip`'s sentinel — see the note there for why it is a literal. */
const UNTITLED_SENTINEL = '(no title)';

export function DayAgendaRow({
  event,
  people,
  current = false,
  past = false,
  last = false,
  hub = false,
  onSelect,
}: DayAgendaRowProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const palette = CATEGORY_CLASSES[event.category];

  const title = event.busyOnly
    ? t('busy')
    : event.title === UNTITLED_SENTINEL
      ? t('untitled')
      : event.title;

  // An event nobody is named on is the household's — which is what the board
  // has always meant by putting it in the "Iedereen" block.
  const who = people && people.length > 0 ? people.join(' · ') : t('everyone');
  const interactive = onSelect !== undefined && event.editable;

  return (
    <div
      data-slot="day-agenda-row"
      data-category={event.category}
      data-current={current || undefined}
      data-past={past || undefined}
      data-busy-only={event.busyOnly || undefined}
      data-pending-sync={event.pendingSync || undefined}
      data-recurring={event.recurring || undefined}
      data-event-id={event.seriesId}
      data-occurrence-start={event.startsAt.toISOString()}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? () => onSelect(event) : undefined}
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
      className={cn(
        'flex gap-3.5 text-left',
        interactive && 'cursor-pointer transition-colors duration-200 ease-brand'
      )}
    >
      {/* The time rail: start only, and the connector that turns a stack of
          rows into one day going past. */}
      <div className={cn('flex shrink-0 flex-col items-center', hub ? 'w-16' : 'w-11')}>
        <span
          className={cn(
            'tnum',
            hub ? 'text-body' : 'text-caption',
            current ? 'font-bold text-primary' : 'text-ink-secondary',
            past && !current && 'text-ink-muted'
          )}
        >
          {event.allDay
            ? t('allDay')
            : formatDateTime(event.startsAt, { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!last && (
          <span
            aria-hidden
            data-slot="day-agenda-connector"
            className="mt-1 min-h-[22px] w-px flex-1 bg-line-strong"
          />
        )}
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-0.5 pb-3',
          // The current event is the one thing on this board that gets a
          // surface of its own: a full-width tint, so it is findable from
          // across the kitchen without reading a word of it.
          current && 'mb-2 rounded-xl bg-primary/6 px-3 py-2',
          interactive && !current && 'rounded-xl hover:bg-surface-container-low'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <CategoryDot
            size={hub ? 'md' : 'sm'}
            className={cn(palette.solid, past && 'bg-ink-muted')}
          />
          <span
            className={cn(
              'truncate',
              hub ? 'text-body-lg' : 'text-body-sm',
              current ? 'font-bold text-ink' : 'font-normal',
              past ? 'text-ink-muted' : 'text-ink'
            )}
          >
            {title}
          </span>

          {current && (
            <Badge variant="status" data-testid="now-badge" className="uppercase">
              {t('now')}
            </Badge>
          )}

          {/* Non-blocking sync pip (§5) — the edit landed locally, Google has
              not caught up. Never a modal, never an error: a dot. */}
          {event.pendingSync && (
            <span
              data-testid="pending-sync-pip"
              title={t('pendingSync')}
              aria-label={t('pendingSync')}
              role="img"
              className="size-1.5 shrink-0 rounded-full bg-warning"
            />
          )}
        </div>

        {/* The sub-label is *who*, aligned under the title rather than under
            the dot — the spec's `margin-left:16px`. No location, no calendar
            name, no recurrence glyph: this board answers what and for whom. */}
        <span
          className={cn(
            'ml-4 truncate text-ink-secondary',
            hub ? 'text-body' : 'text-caption',
            past && 'text-ink-muted'
          )}
        >
          {who}
        </span>
      </div>
    </div>
  );
}
