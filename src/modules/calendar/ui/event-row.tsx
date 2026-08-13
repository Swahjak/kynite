'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { MemberFace } from '@/components/kynite';
import { Icon } from '@/components/ui/icon';
import type { CalendarEvent } from '../queries';
import type { EventCategory } from '../schema';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS } from './tokens';

/**
 * `calendar.md` § "Event list item", literally.
 *
 * The design system draws a listed event — as opposed to a *positioned* one —
 * as four columns:
 *
 * 1. `width:4px;align-self:stretch;border-radius:9999px;background:oklch(58% 0.14 H)`
 * 2. a `56px` time column: start `tnum;font-weight:600;font-size:14px`, end
 *    `tnum;font-size:12px;color:#747688`
 * 3. a flexible title column: title `font-weight:600;font-size:15px`, meta
 *    `font-size:12px;color:#434656`
 * 4. a trailing `28px` avatar with a `2px` white ring
 *
 * inside a row of `display:flex;align-items:center;gap:14px;padding:14px 16px;
 * border-top:1px solid #e1e3e4`.
 *
 * `EventChip` cannot be that row and stay itself: it is a *block* — a tinted
 * rectangle that has to survive being 40px tall in an hour grid or 5mm wide in
 * a month cell, so it stacks its title over its time and can afford neither a
 * fixed time column nor an avatar. The two shapes are both in the design
 * system; this file is the list one. Grids, month cells and the all-day strip
 * keep the chip.
 *
 * The 15px title is the one measurement not taken verbatim: this app's type
 * scale (`globals.css`, from `typography.md`) has no 15px step, so the title
 * takes `text-body` (16px) — the nearest declared step, and the one that keeps
 * the title above the 14px start time as the spec intends. Everything else maps
 * exactly: 14px = `text-body-sm`, 12px = `text-caption`, 4px bar = `w-1`, 56px
 * column = `w-14`, 14px gap = `gap-3.5`, `14px 16px` padding = `px-4 py-3.5`,
 * `#e1e3e4` = `--line-subtle`, `#747688`/`#434656` = `--ink-muted`/
 * `--ink-secondary`, 28px avatar = `MemberFace size="sm"`.
 */

/**
 * A face for the trailing avatar slot. Deliberately structural rather than
 * `Member`: the trailing avatar is "whose event is this", and a caller that has
 * only a colour and a name (a share view, a hub payload) can answer that
 * without this component reaching into `@/modules/family` — which is
 * `server-only` and would put the Postgres client in the browser bundle.
 */
export type EventRowPerson = {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  color: EventCategory;
};

export type EventRowProps = {
  event: CalendarEvent;
  /**
   * Faces at the row's trailing edge, in render order. Capped at three; the
   * rest become a `+n`, the same way `Avatar/Group` stacks.
   */
  people?: EventRowPerson[];
  /** Hub surfaces render at 6-foot legibility — one step up the same scale. */
  hub?: boolean;
  /** The event has already finished: it recedes, it is not marked failed. */
  past?: boolean;
  /** Omits the top divider — for the first row under a section label. */
  first?: boolean;
  onSelect?: (event: CalendarEvent) => void;
  className?: string;
};

/** Mirrors `EventChip`'s sentinel — see the note there for why it is a literal. */
const UNTITLED_SENTINEL = '(no title)';

/** The spec draws one trailing avatar; a shared event may need a few. */
const MAX_FACES = 3;

export function EventRow({
  event,
  people,
  hub = false,
  past = false,
  first = false,
  onSelect,
  className,
}: EventRowProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const palette = CATEGORY_CLASSES[event.category];

  const title = event.busyOnly
    ? t('busy')
    : event.title === UNTITLED_SENTINEL
      ? t('untitled')
      : event.title;

  const interactive = onSelect !== undefined && event.editable;
  const faces = people?.slice(0, MAX_FACES) ?? [];
  const overflow = (people?.length ?? 0) - faces.length;

  return (
    <div
      data-slot="event-row"
      data-category={event.category}
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
        'flex items-center gap-3.5 px-4 py-3.5 text-left',
        !first && 'border-t border-line-subtle',
        hub && 'gap-4 px-5 py-4',
        interactive &&
          'cursor-pointer rounded-xl transition-colors duration-200 ease-brand hover:bg-surface-container-low active:scale-[0.99]',
        // A finished event stays legible and recedes — the M17 finding: the
        // recede is never `opacity-*` on a container that holds text.
        past && 'text-ink-muted',
        className
      )}
    >
      {/* 1. The category bar. `palette.solid` as a *fill*, not `palette.rule`
          as a border colour: same `oklch(58% 0.14 H)` hue, but this bar is an
          element of its own here rather than a `border-left` on the row. */}
      <span
        aria-hidden
        data-slot="event-row-bar"
        className={cn(
          'w-1 shrink-0 self-stretch rounded-full',
          palette.solid,
          past && 'opacity-60'
        )}
      />

      {/* 2. The time column. Tabular, so a stack of rows lines its digits up. */}
      <div className={cn('flex shrink-0 flex-col', hub ? 'w-20' : 'w-14')}>
        {event.allDay ? (
          <span className={cn('tnum font-semibold', hub ? 'text-body-lg' : 'text-body-sm')}>
            {t('allDay')}
          </span>
        ) : (
          <>
            <span className={cn('tnum font-semibold', hub ? 'text-body-lg' : 'text-body-sm')}>
              {format.dateTime(event.startsAt, { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className={cn('tnum text-ink-muted', hub ? 'text-body' : 'text-caption')}>
              {format.dateTime(event.endsAt, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </>
        )}
      </div>

      {/* 3. Title and meta. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          {!event.busyOnly && (
            <Icon
              name={EVENT_TYPE_ICONS[event.eventType]}
              size={hub ? 'sm' : 'xs'}
              className={cn('shrink-0', palette.text)}
            />
          )}
          <span className={cn('truncate font-semibold', hub ? 'text-h3' : 'text-body')}>
            {title}
          </span>

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
          {event.recurring && !event.pendingSync && (
            <Icon
              name="repeat"
              size="xs"
              label={t('recurring')}
              className="shrink-0 text-ink-muted"
            />
          )}
        </div>

        {event.location && (
          <span
            className={cn(
              'flex min-w-0 items-center gap-1 text-ink-secondary',
              hub ? 'text-body' : 'text-caption'
            )}
          >
            <Icon name="location_on" size="xs" className="shrink-0" />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </div>

      {/* 4. The trailing faces: `28px`, `border:2px solid #ffffff` — the ring
          is drawn against the card the row sits on, which is what white is in
          the source. */}
      {faces.length > 0 && (
        <div data-slot="event-row-faces" className="flex shrink-0 -space-x-2">
          {faces.map((person) => (
            <MemberFace
              key={person.id}
              size={hub ? 'default' : 'sm'}
              avatarUrl={person.avatarUrl}
              name={person.displayName}
              surfaceClass={CATEGORY_CLASSES[person.color].surface}
              className="ring-2 ring-card"
            />
          ))}
          {overflow > 0 && (
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full bg-muted font-display font-bold text-ink-muted ring-2 ring-card',
                'text-caption'
              )}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
