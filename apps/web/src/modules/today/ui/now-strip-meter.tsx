'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ProgressBar } from '@kynite/ui';
import { useRouter } from '@/i18n/navigation';
import { elapsedRatio, minutesRemaining, startsInReading } from '../domain/flow';

/**
 * The part of the NU strip a clock changes.
 *
 * The strip's title, glyph and faces are facts about the *event* and stay
 * server-rendered; the countdown and the bar are facts about **now**, and a
 * server render of those is a photograph — "nog 18 min" is wrong within the
 * minute and badly wrong an hour later. This is the same bargain
 * `now-hero-clock.tsx` struck for the card this replaces, at a quarter of the
 * size: one tick, one component re-rendering on it, the server's values as
 * initial state so the first paint matches the HTML.
 *
 * The tick runs at half the displayed resolution: a 60s interval started
 * mid-minute lands the visible number up to a full minute late, which is
 * exactly the staleness this exists to remove.
 *
 * **State transitions** (live → next → clear) need the rest of the day, which
 * this component deliberately does not have. When the block it is about crosses
 * its own boundary it asks the server to render again — once, guarded by a ref
 * so a slow refresh is not re-requested on every tick — and the page's own
 * `flowOf` answers the question it already answers.
 */

const TICK_MS = 30_000;

export type NowStripMeterProps = {
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  /** `live` counts down to the end and fills the bar; `next` counts up to the start. */
  state: 'live' | 'next';
  /** The server's `now`, so the first client render matches the HTML. */
  initialNow: Date;
  /**
   * `startsAt` formatted as `HH:mm` in the household's locale and zone —
   * already resolved by the server half, the same way `people` is. Used only
   * once the countdown crosses into the "om 19:30" reading (`startsInReading`
   * in `../domain/flow`); `startsAt` itself never changes tick to tick, so
   * there is nothing this component needs to reformat client-side.
   */
  startsAtLabel: string;
  /** "Mila & Daan" — already resolved by the server half. */
  people: string;
  /**
   * The avatar stack, rendered on the server and handed through.
   *
   * It sits on the same line as the countdown, and `MemberFaces` reaches
   * `@/modules/family` — which is `server-only`. Passing the finished element
   * keeps the database driver out of this bundle while keeping the two halves
   * of one sentence in one flex row.
   */
  faces?: ReactNode;
};

export function NowStripMeter({
  startsAt,
  endsAt,
  allDay,
  state,
  initialNow,
  startsAtLabel,
  people,
  faces,
}: NowStripMeterProps) {
  const t = useTranslations('today');
  const router = useRouter();

  const [now, setNow] = useState(initialNow);
  const refreshed = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (refreshed.current) return;
    const boundary = state === 'live' ? endsAt.getTime() : startsAt.getTime();
    if (now.getTime() < boundary) return;
    refreshed.current = true;
    router.refresh();
  }, [now, state, startsAt, endsAt, router]);

  const block = { startsAt, endsAt, allDay };
  const live = state === 'live';
  const reading = startsInReading(block, now);
  const detail = live
    ? t('nowStrip.remaining', { minutes: minutesRemaining(block, now) })
    : reading.kind === 'minutes'
      ? t('nowStrip.startsIn', { minutes: reading.minutes })
      : reading.kind === 'hours'
        ? t('nowStrip.startsInHours', { hours: reading.hours })
        : t('nowStrip.startsAt', { time: startsAtLabel });

  // Two grid children, not one wrapper: the bar spans the whole strip while the
  // countdown sits in the text column beside the glyph tile (see the grid in
  // `today-now-strip.tsx`).
  return (
    <>
      <div className="col-start-2 mt-1 flex min-w-0 items-center gap-1.5">
        {faces}
        <span data-testid="today-now-detail" className="truncate text-caption text-ink-secondary">
          {people ? `${people} · ${detail}` : detail}
        </span>
      </div>

      {/* Only a live block has a "how far through" to draw. An upcoming one
          would render an empty track, which reads as progress lost rather than
          progress not yet made. */}
      {live && !allDay ? (
        <ProgressBar
          data-testid="today-now-progress"
          value={Math.round(elapsedRatio(block, now) * 100)}
          // 8px, the design's own ("Vandaag.dc.html":91). `sm` draws 6px,
          // which on a wall read as a hairline rather than as a bar.
          size="md"
          className="col-span-2 mt-3"
        />
      ) : null}
    </>
  );
}
