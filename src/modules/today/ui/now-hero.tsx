import { getFormatter, getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { EVENT_TYPE_ICONS, type CalendarEvent } from '@/modules/calendar';
import type { Member } from '@/modules/family';
import type { FlowMode } from '../domain/flow';
import { MemberFaces, participantsOf } from './member-faces';
import { NowHeroClock } from './now-hero-clock';

/**
 * The "NOW" hero — `docs/design/stitch/.../today_s_flow_light_mode/code.html:20-56`,
 * and the first row of `docs/rebuild-design-gaps.md` §3 that this page was
 * missing entirely.
 *
 * Filled primary, one per screen, with the ring measuring how far through the
 * current block the family is and the arrow leading into the day. Four states,
 * one per `FlowMode`:
 *
 * - **live** — something is happening. The ring fills, the centre counts the
 *   minutes left, the eyebrow says NOW. The counting half is a client component
 *   (`now-hero-clock.tsx`) so it stays true minute to minute.
 * - **next** — nothing right now, but something is coming. The same card, an
 *   empty ring, and the start time instead of a remaining count. A *future* day
 *   browsed with `?date=` reads this way too: its first block, no live claim.
 * - **past** — a day that is over. No ring and no countdown: "in 9 minutes" is
 *   nonsense about yesterday. The card becomes a record of what was planned.
 * - **clear** — nothing to show. A `celebration` glyph and a sentence, on the
 *   same filled surface: an empty day is a result, not a gap in the layout.
 *
 * The mockup's white circular button is an "advance to the next step" control
 * for a routine. Routines are checked off on the hub and on `/routines`, not
 * here, so it keeps the affordance and points it at the calendar day the block
 * lives on — the one place a parent can actually act on it.
 */

export type NowHeroProps = {
  event: CalendarEvent | null;
  /** How the card should read (`domain/flow.ts#flowOf`). */
  mode: FlowMode;
  members: Member[];
  now: Date;
  timeZone: string;
  /** `YYYY-MM-DD` of the day being shown — the arrow's destination. */
  dayKey: string;
};

export async function NowHero({ event, mode, members, now, timeZone, dayKey }: NowHeroProps) {
  const t = await getTranslations('today');
  const format = await getFormatter();

  const at = (instant: Date) =>
    format.dateTime(instant, { hour: '2-digit', minute: '2-digit', timeZone });

  const past = mode === 'past';

  if (!event || mode === 'clear') {
    return (
      <Card variant="hero" data-testid="today-now" data-state="clear" className="min-h-48 p-6">
        <Glow />
        <div className="relative z-10 flex flex-1 flex-col items-start justify-center gap-2">
          <Icon name={past ? 'schedule' : 'celebration'} size="2xl" />
          <h2 className="font-display text-h1">
            {past ? t('now.pastClearTitle') : t('now.clearTitle')}
          </h2>
          <p className="text-body text-primary-foreground">
            {past ? t('now.pastClearBody') : t('now.clearBody')}
          </p>
        </div>
      </Card>
    );
  }

  const participants = participantsOf(event);

  return (
    <Card
      variant="hero"
      data-testid="today-now"
      data-state={mode}
      className="min-h-56 gap-6 p-6 sm:min-h-72 sm:p-8"
    >
      <Glow />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <span className="rounded-4xl bg-brand-container/40 px-3 py-1 text-overline text-primary-foreground uppercase">
            {mode === 'live'
              ? t('now.eyebrowLive')
              : past
                ? t('now.eyebrowPast')
                : t('now.eyebrowNext')}
          </span>
          <h2 className="font-display text-h1 break-words">{event.title}</h2>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-primary-foreground">
            <span className="tabular-nums">
              {event.allDay ? t('allDay') : `${at(event.startsAt)} – ${at(event.endsAt)}`}
            </span>
            {event.location ? (
              <span className="inline-flex items-center gap-1">
                <Icon name="location_on" size="sm" />
                {event.location}
              </span>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <Icon name={EVENT_TYPE_ICONS[event.eventType]} size="xl" className="opacity-60" />
          <MemberFaces members={members} memberIds={participants} size="default" />
        </div>
      </div>

      <div className="relative z-10 mt-auto flex items-center justify-between gap-4 rounded-2xl bg-brand-container/30 p-4 sm:p-6">
        {mode === 'live' || mode === 'next' ? (
          <NowHeroClock
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            allDay={event.allDay}
            state={mode}
            initialNow={now}
            timeZone={timeZone}
          />
        ) : (
          // A browsed day gets no ring and no countdown — only the fact of what
          // stands (or stood) there. Nothing here ticks, so nothing here is a
          // client component either.
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <span className="flex size-20 shrink-0 items-center justify-center rounded-4xl bg-brand-container/40 sm:size-24">
              <Icon name="schedule" size="2xl" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="font-display text-h3">
                {past ? t('now.pastTitle') : t('now.startsTitle')}
              </span>
              <span className="text-body text-primary-foreground">
                {event.allDay
                  ? t('allDay')
                  : past
                    ? t('now.pastBody', { start: at(event.startsAt), end: at(event.endsAt) })
                    : t('now.startsLabel', { time: at(event.startsAt) })}
              </span>
            </div>
          </div>
        )}

        <Link
          href={`/calendar?view=day&date=${dayKey}`}
          aria-label={t('now.openDay')}
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-4xl bg-primary-foreground text-primary shadow-lg transition-transform duration-200 ease-brand',
            'hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground sm:size-16'
          )}
        >
          <Icon name="arrow_forward" size="xl" />
        </Link>
      </div>
    </Card>
  );
}

/**
 * The radial bloom behind the eyebrow. Purely decorative and `aria-hidden` by
 * having no content at all; `Card variant="hero"` is `relative` for exactly
 * this (see its variant note).
 */
function Glow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-4xl bg-brand-container/30 blur-3xl"
    />
  );
}
