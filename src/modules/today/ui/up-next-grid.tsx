import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import { formatDateTime } from '@/i18n/formatting-locale';
import { cn } from '@/lib/utils';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS, type CalendarEvent } from '@/modules/calendar';
import { getHouseholdFormattingLocale, type Member } from '@/modules/family';
import type { FlowMode } from '../domain/flow';
import { MemberFaces, participantsOf } from './member-faces';

/**
 * "Up Next" — `docs/design/stitch/.../today_s_flow_light_mode/code.html:58-104`.
 *
 * A two-column grid of tinted cards: the time in the block's own category
 * colour, the faces of whoever it belongs to, the title, and one line of
 * detail. One column at 390px, two from `sm` up — the mockup is a landscape hub
 * and a phone cannot hold two of these side by side and still be readable.
 *
 * The dashed "Free time!" slot is not an empty-state fallback, it is a *tile*:
 * the mockup renders it alongside real blocks, and the message it carries — the
 * rest of the day is yours — is worth as much space as an appointment. It shows
 * whenever the list is shorter than the grid it fills, which includes the
 * (common, good) case of a day with nothing left on it.
 */

export type UpNextGridProps = {
  events: CalendarEvent[];
  members: Member[];
  timeZone: string;
  /** How many tiles the grid was asked for — decides if there is room to spare. */
  limit: number;
  /** Which day this is (`domain/flow.ts`) — "up next" is not true of yesterday. */
  mode: FlowMode;
};

export async function UpNextGrid({ events, members, timeZone, limit, mode }: UpNextGridProps) {
  const t = await getTranslations('today');
  const formattingLocale = await getHouseholdFormattingLocale();

  const past = mode === 'past';

  return (
    <section data-testid="today-up-next" data-mode={mode} className="flex flex-col gap-3">
      <h3 className="pl-1 text-overline text-ink-muted uppercase">
        {past ? t('upNext.pastTitle') : t('upNext.title')}
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {events.map((event) => {
          const palette = CATEGORY_CLASSES[event.category];

          return (
            <article
              key={event.key}
              data-slot="up-next-card"
              data-category={event.category}
              className={cn(
                // Left rule only — no `border-line-subtle` frame. `palette.rule`
                // (`border-cat-*-solid`) sets border-*color* on all four sides;
                // pairing it with a full 1px `border` colored every edge in the
                // category hue instead of just the intended 4px left bar. Match
                // `event-chip.tsx`'s pattern: `border-l-4` + `palette.rule` alone.
                'flex min-h-36 flex-col justify-between gap-4 rounded-2xl border-l-4 p-5 shadow-sm',
                palette.surface,
                palette.rule
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className={cn('font-display font-bold tabular-nums', palette.text)}>
                  {event.allDay
                    ? t('allDay')
                    : formatDateTime(event.startsAt, formattingLocale, {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone,
                      })}
                </span>
                <MemberFaces members={members} memberIds={participantsOf(event)} size="default" />
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="truncate font-display text-h3">{event.title}</h4>
                  {event.location || event.description ? (
                    <p className="truncate text-body-sm text-ink-secondary">
                      {event.location ?? event.description}
                    </p>
                  ) : null}
                </div>
                {/* The watermark glyph the mockup puts on a typed block. */}
                <Icon
                  name={EVENT_TYPE_ICONS[event.eventType]}
                  size="md"
                  className={cn('shrink-0 opacity-70', palette.text)}
                />
              </div>
            </article>
          );
        })}

        {/* "Free time!" is an invitation, and you cannot be invited into a day
            that is over — the tile is for today and for days still to come. */}
        {!past && events.length < limit ? (
          <div
            data-slot="up-next-free"
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface-container-lowest p-5 text-ink-muted"
          >
            <Icon name="celebration" size="xl" />
            <span className="font-display text-h3">{t('upNext.free')}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
