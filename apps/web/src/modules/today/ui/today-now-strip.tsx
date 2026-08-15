import { getTranslations } from 'next-intl/server';
import { Card, cn, Icon } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES, EVENT_TYPE_ICONS, type CalendarEvent } from '@/modules/calendar';
import { getHouseholdFormattingLocale, type Member } from '@/modules/family';
import type { FlowMode } from '../domain/flow';
import { MemberFaces, joinNames, namesOf, participantsOf } from './member-faces';
import { NowStripMeter } from './now-strip-meter';

/**
 * The "NU" strip — one line about what is happening right now.
 *
 * It replaces the M19 pair of a filled-primary hero card and a four-tile "Up
 * Next" grid, which between them took the whole first screen of `/today` to say
 * two things a family already half knows. The rebuild gives that space to the
 * day itself (the tabs below) and compresses the live block into a single
 * tinted strip: the glyph and colour of what it is, the word NU, its title, who
 * it is for, how long is left, and a bar showing how far through it is.
 *
 * Five states, one per `FlowMode` (`domain/flow.ts`):
 *
 * - **live** — the NU badge, the countdown, the bar filling.
 * - **next** — a STRAKS badge and a starts-in count. No bar: an empty track
 *   reads as progress lost rather than progress not yet made.
 * - **preview** — a *future* day being browsed. Its first block, stated with a
 *   clock time rather than counted down, because "over 9 uur" is not what a
 *   parent is asking when they tap tomorrow.
 * - **past** / **clear** — a friendly single line. Nothing counts, nothing
 *   fills, and the strip keeps its place in the layout so the page does not
 *   reflow between days.
 *
 * The countdown half is a client component (`now-strip-meter.tsx`); everything
 * else here is a fact about the event and stays on the server.
 */

export type TodayNowStripProps = {
  event: CalendarEvent | null;
  mode: FlowMode;
  members: Member[];
  now: Date;
  timeZone: string;
};

export async function TodayNowStrip({ event, mode, members, now, timeZone }: TodayNowStripProps) {
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');
  const formattingLocale = await getHouseholdFormattingLocale();

  const at = (instant: Date) =>
    formatDateTime(instant, formattingLocale, { hour: '2-digit', minute: '2-digit', timeZone });

  if (!event || mode === 'clear' || mode === 'past') {
    const clear = mode === 'clear' || !event;

    return (
      <Card
        variant="muted"
        data-testid="today-now"
        data-state={mode}
        className="flex-row items-center gap-3 rounded-3xl p-4 sm:p-5"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-surface-container-lowest text-ink-muted">
          <Icon name={clear ? 'celebration' : 'schedule'} size="lg" />
        </span>
        <p className="min-w-0 text-body-sm text-ink-secondary">
          {clear ? t('nowStrip.clear') : t('nowStrip.past')}
        </p>
      </Card>
    );
  }

  const palette = CATEGORY_CLASSES[event.category];
  const ids = participantsOf(event);
  // A household event belongs to everybody by construction, and so does one
  // that names nobody at all — "Iedereen" is a different fact from a list of
  // names, not a longer one.
  const everyone = event.householdWide || ids.length === 0 || ids.length >= members.length;
  const people = everyone ? tCalendar('everyone') : joinNames(namesOf(members, ids));
  const faceIds = everyone ? members.map((member) => member.id) : ids;

  const live = mode === 'live';
  const counted = live || mode === 'next';

  // Rendered here and handed to the (client) meter as a node: `MemberFaces`
  // reaches `@/modules/family`, which is `server-only`.
  const faces = (
    <MemberFaces
      members={members}
      memberIds={faceIds}
      size="xs"
      // The faces sit on the tinted card, not on white, so their separating
      // ring has to be the card's own ground.
      className="[&_[data-slot=avatar]]:ring-surface-container"
    />
  );

  return (
    <Card
      variant="muted"
      data-testid="today-now"
      data-state={mode}
      className="relative gap-0 overflow-hidden rounded-3xl p-4 sm:p-5"
    >
      {/* The mockup's soft bloom in the top-right corner. Decorative by having
          no content at all; the card is `relative` for exactly this. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 size-30 rounded-4xl bg-primary/8 blur-2xl"
      />

      {/* A two-column grid rather than nested flexes: the progress bar has to
          span the *whole* strip, and the countdown beside it has to sit in the
          text column. One grid says both. */}
      <div className="relative grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3.5">
        {/* A squircle tile in the event's own category tint, at the design's
            48px. `IconMedallion` carries no category tints — category is the
            calendar's vocabulary, not the medallion's — so the hue arrives as
            a class pair. */}
        <span
          className={cn(
            // 48px at `rounded-xl`, not `rounded-2xl`: the design draws the
            // tile as a squircle of radius 14 ("Vandaag.dc.html":82) and 12px
            // is the token nearest it — `rounded-2xl` (16px) rounds a 48px box
            // far enough to read as a circle once the kiosk scale is on.
            'row-span-2 flex size-12 shrink-0 items-center justify-center rounded-xl',
            palette.surface
          )}
        >
          <Icon
            name={event.busyOnly ? 'lock' : EVENT_TYPE_ICONS[event.eventType]}
            size="lg"
            className={palette.text}
          />
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="rounded-4xl bg-primary px-2.5 py-0.5 text-overline text-primary-foreground uppercase">
            {live ? t('now.eyebrowLive') : t('now.eyebrowNext')}
          </span>
          {/* One of the two elements on a wall display that has to read from
              two metres — the other is the clock. Everything else on the board
              is for whoever is standing at the tablet. */}
          <span className="min-w-0 truncate font-display text-h3 font-extrabold">
            {event.busyOnly ? tCalendar('busy') : event.title}
          </span>
        </div>

        {counted ? (
          <NowStripMeter
            startsAt={event.startsAt}
            endsAt={event.endsAt}
            allDay={event.allDay}
            state={live ? 'live' : 'next'}
            initialNow={now}
            people={people}
            faces={faces}
          />
        ) : (
          // A browsed future day: the same line, with a clock time in place of
          // a countdown. Nothing ticks, so nothing here is a client component
          // either.
          <div className="col-start-2 mt-1 flex min-w-0 items-center gap-1.5">
            {faces}
            <span className="truncate text-caption text-ink-secondary">
              {people ? `${people} · ` : ''}
              {event.allDay ? t('allDay') : t('now.startsLabel', { time: at(event.startsAt) })}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
